// Kopiuje pliki aplikacji webowej (katalog główny repozytorium) do mobile/www – to je pakuje Capacitor.
import { cpSync, rmSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..'), out = join(root, 'mobile', 'www');
const SKIP = new Set(['mobile', 'node_modules', 'reports', 'research_notes', '.git', '.github', '.claude', 'README.md', 'SUPABASE.md', 'supabase.sql']);
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
for (const f of readdirSync(root)) if (!SKIP.has(f) && !f.startsWith('.')) cpSync(join(root, f), join(out, f), { recursive: true });
console.log('www gotowe:', out);
