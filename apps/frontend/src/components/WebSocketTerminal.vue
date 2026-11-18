<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { io, Socket } from 'socket.io-client'

const props = defineProps<{
    taskId?: string
    /**
     * 历史日志静态文件路径（如 /storage/logs/build-xx.log）。
     * 有值时进入"历史回显"模式，直接拉取文件内容渲染，不连接 WS。
     */
    logPath?: string
    /**
     * 任务状态。running 时无论是否有 logPath，都走实时 WS。
     */
    status?: string
    /**
     * 体验版二维码的签名路径（如 /storage/qrcode-12.jpg?exp=...&sig=...）。
     * 历史回看时 WS 已经不会重发 build_qrcode 事件，需要据此把二维码补出来。
     */
    qrcodePath?: string
}>()

const terminalContainer = ref<HTMLElement | null>(null)
/** 体验版二维码 base64 URL，有值时在终端下方显示 */
const qrcodeDataUrl = ref<string>('')

let term: Terminal | null = null
let socket: Socket | null = null

/** 把后端存储路径拼成可访问的完整 URL（签名参数原样保留） */
const resolveStorageUrl = (storagePath: string): string => {
    const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/api$/, '')
    return `${base}${storagePath}`
}

const initTerminal = () => {
    if (!terminalContainer.value) return

    term = new Terminal({
        cursorBlink: true,
        theme: {
            background: '#18181b',
            foreground: '#e4e4e7',
            cursor: '#8b5cf6',
        },
        rows: 30,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        fontSize: 14,
        disableStdin: true
    })

    term.open(terminalContainer.value)
}

/**
 * 历史日志模式：通过鉴权接口拉取日志内容。
 * 日志文件存放在 var/logs（不在 public 下），不能再用静态路径直连，
 * 否则可以按自增 taskId 遍历拿到所有项目的构建日志。
 */
const loadHistoryLog = async (taskId: string, opts: { silent?: boolean } = {}) => {
    const silent = opts.silent === true
    if (!silent) term?.writeln('\x1b[35m[System]\x1b[0m Loading build log...')
    try {
        const token = localStorage.getItem('avocado-token')
        const apiBase = import.meta.env.VITE_API_BASE_URL || '/api'
        const res = await fetch(`${apiBase}/build-tasks/${taskId}/log`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        })
        if (!res.ok) {
            if (!silent) term?.writeln(`\x1b[31m[System]\x1b[0m Failed to load log (HTTP ${res.status}).`)
            return
        }
        const payload = await res.json()
        const text: string = payload?.data?.content ?? ''
        if (!payload?.data?.exists || !text.trim()) {
            if (!silent) term?.writeln('\x1b[33m[System]\x1b[0m Log file is empty or not found.')
            return
        }
        // 按行写入终端，保留 ANSI 色彩码
        for (const line of text.split(/\r?\n/)) {
            term?.writeln(line)
        }
        term?.writeln(
            silent
                ? '\x1b[32m[System]\x1b[0m ── 以上为此前日志，以下为实时输出 ──'
                : '\x1b[32m[System]\x1b[0m ─── End of log ───'
        )
        // 历史回看：WS 不会再发 build_qrcode，用任务记录里的签名路径把二维码补出来
        if (props.qrcodePath) {
            qrcodeDataUrl.value = resolveStorageUrl(props.qrcodePath)
        }
    } catch (e) {
        if (!silent) term?.writeln(`\x1b[31m[System]\x1b[0m Error loading log: ${(e as Error).message}`)
    }
}

const connectWebSocket = () => {
    if (!props.taskId) return

    qrcodeDataUrl.value = ''

    const token = localStorage.getItem('avocado-token')
    // Use relative path so socket.io connects to the current host
    // which allows Nginx proxy to work seamlessly across different environments
    const wsUrl = import.meta.env.VITE_WS_URL || ''

    socket = io(wsUrl, {
        path: '/socket.io',
        query: { taskId: props.taskId },
        auth: { token }
    })

    socket.on('connect', () => {
        term?.writeln('\x1b[32m[System]\x1b[0m Connected to build terminal.')
        socket!.emit('subscribe_build_logs', { taskId: props.taskId })
    })

    socket.on('build_log_chunk', (data: { taskId: string; log: string; timestamp: string }) => {
        term?.writeln(data.log)
    })

    socket.on('build_qrcode', (data: { taskId: string; base64: string }) => {
        qrcodeDataUrl.value = data.base64
        term?.writeln('\x1b[33m[System]\x1b[0m 体验版二维码已生成，请在下方扫码。')
    })

    socket.on('disconnect', () => {
        term?.writeln('\r\n\x1b[31m[System]\x1b[0m Disconnected from build terminal.')
    })
}

/**
 * 根据 props 决定走哪种模式：
 * - 已结束且有日志 → HTTP 历史回显
 * - 运行中 → 先补一次已有日志，再接 WS 增量
 *
 * 补历史是必须的：构建进行到一半才打开终端时，之前输出的内容不会重发，
 * 用户只能看到「Connected」和之后零星的几行，误以为日志没推送。
 */
const startSession = async () => {
    const isRunning = props.status === 'running' || props.status === 'pending'

    if (!isRunning) {
        if (props.logPath && props.taskId) {
            await loadHistoryLog(props.taskId)
        } else {
            term?.writeln('\x1b[35m[System]\x1b[0m Waiting for build task to start...')
            connectWebSocket()
        }
        return
    }

    // 运行中：先把此刻已有的日志补齐（还没有日志文件时静默跳过）
    if (props.taskId) {
        await loadHistoryLog(props.taskId, { silent: true })
    }
    connectWebSocket()
}

watch(
    () => [props.taskId, props.logPath, props.status],
    () => {
        // 断开旧连接
        if (socket) {
            socket.disconnect()
            socket = null
        }
        // 清屏
        term?.clear()
        qrcodeDataUrl.value = ''
        startSession()
    }
)

onMounted(() => {
    initTerminal()
    startSession()
})

onUnmounted(() => {
    if (socket) {
        socket.disconnect()
    }
    if (term) {
        term.dispose()
    }
})
</script>

<template>
    <div class="terminal-wrapper rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-zinc-950">
        <!-- xterm 终端区域 -->
        <div ref="terminalContainer" class="w-full p-4"></div>

        <!-- 体验版二维码区域（有二维码时显示） -->
        <Transition name="qrcode-slide">
            <div v-if="qrcodeDataUrl"
                class="qrcode-panel border-t border-white/10 px-6 py-5 flex items-center gap-6 bg-zinc-900">
                <div class="qrcode-glow rounded-xl overflow-hidden bg-white p-2 shadow-lg">
                    <img :src="qrcodeDataUrl" alt="体验版二维码" class="w-36 h-36 object-contain block" />
                </div>
                <div class="flex flex-col gap-1">
                    <p class="text-sm font-semibold text-white">体验版二维码</p>
                    <p class="text-xs text-zinc-400">使用微信扫描此二维码即可进入小程序体验版</p>
                    <a :href="qrcodeDataUrl" :download="`qrcode-${taskId}.jpg`"
                        class="mt-2 inline-flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        下载二维码
                    </a>
                </div>
            </div>
        </Transition>
    </div>
</template>

<style scoped>
.terminal-wrapper :deep(.xterm-viewport) {

    /* custom scrollbar for xterm */
    &::-webkit-scrollbar {
        width: 6px;
    }

    &::-webkit-scrollbar-track {
        background: transparent;
    }

    &::-webkit-scrollbar-thumb {
        background: #3f3f46;
        border-radius: 10px;
    }

    &::-webkit-scrollbar-thumb:hover {
        background: #52525b;
    }
}

/* 二维码区域入场动画 */
.qrcode-slide-enter-active {
    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.qrcode-slide-enter-from {
    opacity: 0;
    transform: translateY(12px);
}

/* 二维码辉光效果 */
.qrcode-glow {
    box-shadow: 0 0 24px 4px rgba(139, 92, 246, 0.25);
}
</style>
