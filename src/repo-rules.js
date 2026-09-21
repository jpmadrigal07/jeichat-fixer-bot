export const REPO_RULES = `This is a Turborepo + Bun monorepo. apps/api is NestJS. apps/web is Next.js App Router. Do not introduce a parallel stack, extra HTTP clients, or extra Postgres pools.

- TypeScript strict. No any.
- Package manager is Bun (bun, bunx). Never npm/npx.
- Backend: Module → Controller → Service. Controllers handle HTTP only. Services own logic and Drizzle queries.
- Better Auth and Drizzle share getSharedPgPool(). Never create another pg.Pool.
- Bot-callable routes need @BotAllowed() and @Actor(), not @Session().
- Inject DrizzleService for database access. Throw Nest exceptions.
- Register new modules in app.module.ts. Re-export new schema files from database/schema/index.ts.
- Frontend pages resolve session with getServerSession() from lib/auth-server.ts. Do not import that file in client components.
- Interactive data uses TanStack Query + the shared Axios instance in apps/web/lib/api.ts. Forward { signal } from queryFn to Axios. Do not call Axios inside components.
- Page-local code lives in _components/, _hooks/, _libs/, _helpers/. Promote to app/_*/ only when a second page needs it. Never copy.
- UI is shadcn/ui + Tailwind utilities + lucide-react. Do not edit components/ui/. No custom CSS files.
- Avoid useState / useEffect unless no better option exists (URL state, Query, refs, event handlers, Server Components).
- App tables: snake_case SQL column names, camelCase TypeScript. Auth tables follow Better Auth camelCase columns.
- After schema changes in apps/api: bun run db:generate then bun run db:migrate.`;
