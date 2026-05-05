// app/page.js
import GameEngine from '@/components/GameEngine';
import CrudLivePanel from '@/components/CrudLivePanel';
import TutorialReplayButton from '@/components/TutorialReplayButton';
import EditPlayerButton from '@/components/EditPlayerButton';
import HeaderActionBar from '@/components/HeaderActionBar';
import HeaderStats from '@/components/HeaderStats';

// EDUCATIONAL: layout estilo "tactical HUD".
//   header:  título · ações CRUD · stats em tempo real
//   main:    canvas em tela cheia · CRUD Live flutuando como overlay no canto
export default function Page() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-3 py-2 border-b border-white/5 z-30 relative">
        <div className="flex flex-wrap items-center gap-3 gap-y-2">
          {/* Título + favicon */}
          <div className="flex items-center gap-2 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/favicon.ico"
              alt="CRUD Dungeon"
              width={32}
              height={32}
              className="rounded-md shadow-[0_0_18px_rgba(34,211,238,0.25)] shrink-0"
            />
            <div className="min-w-0">
              <h1 className="font-mono text-cyan-400 text-sm sm:text-base truncate leading-tight">
                CRUD Dungeon
              </h1>
              <p className="text-[9px] sm:text-[10px] text-slate-500 font-mono truncate leading-tight">
                /WASD mover · Espaço agir · ?=GET-tudo
              </p>
            </div>
          </div>

          {/* Ações CRUD — centralizado em telas largas */}
          <div className="flex-1 flex justify-center order-3 lg:order-2 w-full lg:w-auto">
            <HeaderActionBar />
          </div>

          {/* Stats + settings */}
          <div className="flex items-center gap-2 order-2 lg:order-3 ml-auto lg:ml-0">
            <HeaderStats />
            <div className="flex items-center gap-1">
              <EditPlayerButton />
              <TutorialReplayButton />
            </div>
          </div>
        </div>
      </header>

      {/* EDUCATIONAL: main agora é tela cheia. CRUD Live flutua como overlay em vez de
          roubar 40% da largura. Em mobile o painel flutuante encolhe pra não atrapalhar. */}
      <div className="flex-1 relative min-h-0">
        <section className="absolute inset-0 flex">
          <GameEngine />
        </section>
        <aside className="absolute top-2 right-2 z-20 w-[88vw] sm:w-[360px] max-w-[92vw]">
          <CrudLivePanel />
        </aside>
      </div>
    </main>
  );
}
