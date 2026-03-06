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
}>()

const terminalContainer = ref<HTMLElement | null>(null)
/** 体验版二维码 base64 URL，有值时在终端下方显示 */
const qrcodeDataUrl = ref<string>('')

let term: Terminal | null = null
let socket: Socket | null = null

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

/** 历史日志模式：直接 HTTP 拉取日志文件并渲染 */
const loadHistoryLog = async (logPath: string) => {
    term?.writeln('\x1b[35m[System]\x1b[0m Loading build log...')
    try {
        const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/api$/, '')
        const url = `${base}${logPath}`
        const res = await fetch(url)
        if (!res.ok) {
            term?.writeln(`\x1b[31m[System]\x1b[0m Failed to load log (HTTP ${res.status}).`)
            return
        }
        const text = await res.text()
        if (!text.trim()) {
            term?.writeln('\x1b[33m[System]\x1b[0m Log file is empty.')
            return
        }
        // 按行写入终端，保留 ANSI 色彩码
        const lines = text.split(/\r?\n/)
        for (const line of lines) {
            term?.writeln(line)
        }
        term?.writeln('\x1b[32m[System]\x1b[0m ─── End of log ───')
    } catch (e) {
        term?.writeln(`\x1b[31m[System]\x1b[0m Error loading log: ${(e as Error).message}`)
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
 * - status === 'running' 或没有 logPath → 实时 WS
 * - 有 logPath 且非 running → HTTP 历史回显
 */
const startSession = () => {
    const isRunning = props.status === 'running' || props.status === 'pending'
    const hasLogPath = !!props.logPath

    if (hasLogPath && !isRunning) {
        loadHistoryLog(props.logPath!)
    } else {
        term?.writeln('\x1b[35m[System]\x1b[0m Waiting for build task to start...')
        connectWebSocket()
    }
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
