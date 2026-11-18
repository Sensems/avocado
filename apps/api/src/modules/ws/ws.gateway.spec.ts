import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { WsGateway } from './ws.gateway';

describe('WsGateway', () => {
  let gateway: WsGateway;
  const jwtService = { verifyAsync: jest.fn() };

  const fakeClient = (auth: Record<string, unknown>) =>
    ({
      id: 'client-1',
      handshake: { auth, query: {} },
      data: {},
      disconnect: jest.fn(),
    }) as any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [WsGateway, { provide: JwtService, useValue: jwtService }],
    }).compile();

    gateway = module.get<WsGateway>(WsGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it('未携带 token 时立即断开', async () => {
    const client = fakeClient({});
    await gateway.handleConnection(client);
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('token 非法时立即断开', async () => {
    jwtService.verifyAsync.mockRejectedValueOnce(new Error('invalid signature'));
    const client = fakeClient({ token: 'not-a-jwt' });
    await gateway.handleConnection(client);
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('token 合法时保持连接并记录用户身份', async () => {
    jwtService.verifyAsync.mockResolvedValueOnce({ sub: 'user-1', username: 'admin' });
    const client = fakeClient({ token: 'valid' });
    await gateway.handleConnection(client);
    expect(client.disconnect).not.toHaveBeenCalled();
    expect(client.data.userId).toBe('user-1');
    expect(client.data.username).toBe('admin');
  });
});
