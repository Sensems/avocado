<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { io, Socket } from 'socket.io-client'

const props = defineProps<{
    taskId?: string
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
            background: '#18181b', // zinc-950
            foreground: '#e4e4e7', // zinc-200
            cursor: '#8b5cf6', // violet-500
        },
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        fontSize: 14,
        disableStdin: true
    })

    term.open(terminalContainer.value)
    term.writeln('\x1b[35m[System]\x1b[0m Waiting for build task to start...')
}

const connectWebSocket = () => {
    if (!props.taskId) return

    // 每次重连时重置二维码
    qrcodeDataUrl.value = ''

    const token = localStorage.getItem('avocado-token')
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000'

    socket = io(wsUrl, {
        query: { taskId: props.taskId },
        auth: { token }
    })

    socket.on('connect', () => {
        term?.writeln('\x1b[32m[System]\x1b[0m Connected to build terminal.')
        // 加入对应 task 的 room，后端通过 room 广播日志
        socket!.emit('subscribe_build_logs', { taskId: props.taskId })
    })

    socket.on('build_log_chunk', (data: { taskId: string; log: string; timestamp: string }) => {
        term?.writeln(data.log)
    })

    /** 收到体验版二维码，在终端下方展示 */
    socket.on('build_qrcode', (data: { taskId: string; base64: string }) => {
        qrcodeDataUrl.value = data.base64
        term?.writeln('\x1b[33m[System]\x1b[0m 体验版二维码已生成，请在下方扫码。')
    })

    socket.on('disconnect', () => {
        term?.writeln('\r\n\x1b[31m[System]\x1b[0m Disconnected from build terminal.')
    })
}

watch(() => props.taskId, (newVal) => {
    if (socket) {
        socket.disconnect()
    }
    if (term) {
        term.clear()
    }
    qrcodeDataUrl.value = ''
    if (newVal) {
        connectWebSocket()
    }
})

onMounted(() => {
    initTerminal()
    if (props.taskId) {
        connectWebSocket()
    }
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
        <div ref="terminalContainer" class="h-[500px] w-full p-4"></div>

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
