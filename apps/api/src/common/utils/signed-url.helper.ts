import { createHmac, timingSafeEqual } from 'crypto';

/**
 * 静态资源签名 URL。
 *
 * 二维码需要被 IM 机器人直接拉取，不能要求登录态；
 * 但任务 ID 是自增的，裸路径可以被逐个猜测。
 * 折中方案：把路径 + 过期时间做 HMAC 签名附在 query 上，
 * 机器人能访问，外部猜不到，过一段时间自动失效。
 */
function getSecret(): string {
  return (
    process.env.URL_SIGN_SECRET ||
    process.env.JWT_SECRET ||
    'avocado-url-sign-default-do-not-use-in-prod'
  );
}

function computeSignature(path: string, exp: number): string {
  return createHmac('sha256', getSecret()).update(`${path}:${exp}`).digest('base64url').slice(0, 22);
}

/**
 * 为静态路径生成带签名的可访问路径。
 * @param path       静态资源路径，例如 /storage/qrcode-12.jpg
 * @param ttlSeconds 有效期，默认 7 天（与二维码保留策略一致）
 */
export function buildSignedPath(path: string, ttlSeconds: number = 7 * 24 * 3600): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = computeSignature(path, exp);
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}exp=${exp}&sig=${sig}`;
}

/**
 * 校验签名与时序，任一不合法返回 false。
 */
export function verifySignedPath(path: string, exp: number, sig: string): boolean {
  if (!Number.isFinite(exp) || Math.floor(Date.now() / 1000) > exp) {
    return false;
  }
  const expected = Buffer.from(computeSignature(path, exp));
  const provided = Buffer.from(sig ?? '');
  if (expected.length !== provided.length) {
    return false;
  }
  return timingSafeEqual(expected, provided);
}
