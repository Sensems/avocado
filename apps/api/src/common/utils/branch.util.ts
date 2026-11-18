/**
 * 分支名白名单。
 *
 * 分支名会被拼进 `git clone -b <branch>` 的 argv。虽然调用方走的是 execFile
 * 而非 shell，理论上不会解析 `;` 或反引号，但这里仍按最保守的字符集限制：
 * 只允许字母、数字、点、下划线、连字符、斜杠。
 *
 * 触发（trigger / retry）与执行（worker）两侧共用同一份规则，
 * 避免「接口放行、构建时才失败」这种时间差。
 */
export const SAFE_BRANCH_PATTERN = /^[A-Za-z0-9._/-]{1,200}$/;

export function isSafeBranchName(branch: string | null | undefined): boolean {
  return typeof branch === 'string' && SAFE_BRANCH_PATTERN.test(branch);
}
