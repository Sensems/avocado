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
import { JwtService } from '@nestjs/jwt';
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

  constructor(private readonly jwtService: JwtService) {}

  /**
   * 握手阶段校验 JWT。
   * 前端通过 io(url, { auth: { token } }) 传入，同时兼容旧的 query 传参。
   * 校验失败立即断开，避免未授权客户端订阅任意构建日志。
   */
  async handleConnection(client: Socket) {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      (client.handshake.query?.token as string | undefined);

    if (!token) {
      this.logger.warn(`拒绝未携带 token 的连接: ${client.id}`);
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sub?: string; username?: string }>(token);
      client.data.userId = payload.sub;
      client.data.username = payload.username;
      this.logger.log(
        `客户端 ${client.id} 已认证: ${payload.username ?? payload.sub ?? 'unknown'}`,
      );
    } catch {
      this.logger.warn(`拒绝非法 token 的连接: ${client.id}`);
      client.disconnect(true);
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
