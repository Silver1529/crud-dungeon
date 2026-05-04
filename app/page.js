// app/page.js
import GameEngine from '@/components/GameEngine';
import CrudLivePanel from '@/components/CrudLivePanel';
import TutorialReplayButton from '@/components/TutorialReplayButton';

// EDUCATIONAL: split-screen 60/40 desktop, stack vertical em mobile.
// Header e footer são minimalistas; o painel direito carrega a parte educacional.
export default function Page() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-4 py-3 border-b border-white/5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/favicon.ico"
            alt="CRUD Dungeon"
            width={36}
            height={36}
            className="rounded-md shadow-[0_0_20px_rgba(34,211,238,0.25)] shrink-0"
          />
          <div className="min-w-0">
            <h1 className="font-mono text-cyan-400 text-base sm:text-lg truncate">CRUD Dungeon</h1>
            <p className="text-[10px] sm:text-xs text-slate-400 font-mono truncate">
              WASD/setas mover · Espaço/A interagir · build=POST · upgrade=PUT · delete=DELETE · ?=GET
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <TutorialReplayButton />
          <div className="text-[10px] font-mono text-slate-500 hidden sm:block">
            Next.js 16 · MySQL RDS · Kaplay
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        <section className="lg:w-3/5 lg:border-r lg:border-white/5 min-h-[60vh] lg:min-h-0 flex">
          <GameEngine />
        </section>
        <aside className="lg:w-2/5 min-h-[40vh] lg:min-h-0 overflow-hidden">
          <CrudLivePanel />
        </aside>
      </div>
    </main>
  );
}
