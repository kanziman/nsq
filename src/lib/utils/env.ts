/**
 * Vercel(배포) 런타임 여부. 임포트/삭제/폴링 등 로컬 전용 동작 차단에 사용.
 * Vercel은 배포 런타임에 환경변수 VERCEL=1을 주입한다.
 * 서버 컴포넌트·API 라우트에서만 호출한다(클라이언트에는 boolean prop으로 주입).
 */
export function isProductionDeploy(): boolean {
  return process.env.VERCEL === '1';
}
