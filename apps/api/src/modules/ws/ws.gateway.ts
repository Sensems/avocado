import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(WsGateway.name);

  constructor(/* private readonly authService: AuthService */) {}

  // Remove handleConnection async if we don't await anything, or just use it synchronously
  handleConnection(client: Socket) {
    // Basic JWT check placeholder
    // In production, decode JWT and disconnect if invalid
    const token = client.handshake.query.token as string | undefined;

    if (token) {
      try {
        // e.g: this.authService.verify(token);
        this.logger.log(`Client connected with token: ${client.id}`);
      } catch {
        // Drop connection
        this.logger.warn('Invalid token, disconnecting client');
        client.disconnect();
      }
    } else {
      this.logger.log(`Client connected: ${client.id}`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Clients subscribe to a specific build task's logs
   * payload: { taskId: string }
   */
  @SubscribeMessage('subscribe_build_logs')
  async handleSubscribeLogs(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { taskId: string },
  ) {
    const room = `build_logs_${data.taskId}`;
    await client.join(room);
    this.logger.log(`Client ${client.id} subscribed to room: ${room}`);
    return { event: 'subscribed', room };
  }

  /**
   * Broadcast a log chunk to the room.
   * Internal method called by BuildJobProcessor via EventEmitter.
   */
  @OnEvent('build.log')
  handleBuildLogEvent(payload: { taskId: string; logChunk: string }) {
    const room = `build_logs_${payload.taskId}`;
    this.server.to(room).emit('build_log_chunk', {
      taskId: payload.taskId,
      log: payload.logChunk,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 将体验版二维码（base64）广播给 room 内的客户端
   */
  @OnEvent('build.qrcode')
  handleBuildQrcodeEvent(payload: { taskId: string; base64: string }) {
    const room = `build_logs_${payload.taskId}`;
    this.server.to(room).emit('build_qrcode', {
      taskId: payload.taskId,
      base64: payload.base64,
    });
  }
}
