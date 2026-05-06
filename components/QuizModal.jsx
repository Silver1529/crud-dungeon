// components/QuizModal.jsx
'use client';
// EDUCATIONAL: quiz pós-tutorial. Pool de 25 perguntas (AWS, SQL, CRUD).
// Cada partida sorteia 5 perguntas aleatórias — ninguém vê o quiz inteiro.
// Múltipla escolha, feedback imediato, badge final.
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, CheckCircle2, XCircle, Award, ArrowRight } from 'lucide-react';
import { QUIZ_DONE_KEY, COLOR_MAP } from '@/lib/game/constants';

// Pool completo. 25 perguntas — toda partida sorteia QUESTIONS_PER_RUN.
const QUESTIONS_PER_RUN = 5;

const QUESTION_POOL = [
  {
    id: 'aws-q1',
    op: 'AWS',
    color: 'amber',
    sql: 'AWS · Amazon Web Services',
    prompt: 'O que é AWS?',
    options: [
      { key: 'a', label: 'Plataforma de computação em nuvem da Amazon', correct: true,
        why: 'É a plataforma de nuvem da Amazon. Em vez de comprar servidores físicos, você "aluga" tudo pela internet — armazenamento, banco, servidores — pagando só pelo uso.' },
      { key: 'b', label: 'Sistema operacional da Microsoft', correct: false, why: 'Não — AWS é serviço de nuvem, não SO.' },
      { key: 'c', label: 'Editor de código', correct: false, why: 'Não. AWS é infraestrutura, não IDE.' },
      { key: 'd', label: 'Banco de dados local', correct: false, why: 'AWS oferece bancos, mas é uma plataforma inteira de nuvem.' },
    ],
  },
  {
    id: 'cloud',
    op: 'NUVEM',
    color: 'cyan',
    sql: 'Cloud Computing',
    prompt: 'O que significa "computação em nuvem"?',
    options: [
      { key: 'a', label: 'Guardar arquivos só no PC pessoal', correct: false, why: 'O oposto — o ponto da nuvem é NÃO depender do PC local.' },
      { key: 'b', label: 'Usar recursos de TI pela internet', correct: true,
        why: 'É usar recursos de TI pela internet em vez do seu próprio computador. Você acessa de qualquer lugar e não depende de um único dispositivo.' },
      { key: 'c', label: 'Imprimir em rede sem fio', correct: false, why: 'Isso é impressão wireless, não nuvem.' },
      { key: 'd', label: 'Compactar arquivos pra enviar', correct: false, why: 'Isso é compressão (zip/tar). Nuvem é outra coisa.' },
    ],
  },
  {
    id: 's3',
    op: 'S3',
    color: 'violet',
    sql: 'AWS S3 · Object Storage',
    prompt: 'Pra que serve o Amazon S3?',
    options: [
      { key: 'a', label: 'Rodar código sem servidor', correct: false, why: 'Isso é Lambda, não S3.' },
      { key: 'b', label: 'Servir banco SQL gerenciado', correct: false, why: 'Isso é RDS. S3 é storage.' },
      { key: 'c', label: 'Armazenar arquivos (imagens, vídeos, backups)', correct: true,
        why: 'S3 é o serviço de armazenamento de arquivos. Guarda imagens, vídeos, backups e qualquer tipo de arquivo. Muito seguro e escalável — funciona pra poucas coisas ou pra milhões de arquivos.' },
      { key: 'd', label: 'Servir páginas HTML como CDN', correct: false, why: 'S3 pode hospedar site estático, mas o "core" é storage. CDN da AWS é o CloudFront.' },
    ],
  },
  {
    id: 'ec2',
    op: 'EC2',
    color: 'amber',
    sql: 'AWS EC2 · Elastic Compute',
    prompt: 'O que é Amazon EC2?',
    options: [
      { key: 'a', label: 'Computador virtual na nuvem', correct: true,
        why: 'EC2 é um computador virtual na nuvem. Você cria um servidor em poucos minutos e roda aplicações nele — sites, APIs, jobs em lote.' },
      { key: 'b', label: 'Cache em memória', correct: false, why: 'Isso é ElastiCache, não EC2.' },
      { key: 'c', label: 'Sistema de filas', correct: false, why: 'Isso é SQS.' },
      { key: 'd', label: 'CDN global', correct: false, why: 'Isso é CloudFront.' },
    ],
  },
  {
    id: 'lambda',
    op: 'LAMBDA',
    color: 'rose',
    sql: 'AWS Lambda · Serverless',
    prompt: 'Pra que serve o AWS Lambda?',
    options: [
      { key: 'a', label: 'Servir um banco de dados gigante', correct: false, why: 'Isso é RDS/DynamoDB.' },
      { key: 'b', label: 'Armazenar imagens pesadas', correct: false, why: 'Isso é S3.' },
      { key: 'c', label: 'Rodar código sem precisar criar servidor', correct: true,
        why: 'Lambda permite rodar código sem precisar criar servidor. Você só envia o código, e ele executa automaticamente quando necessário. Economiza tempo e dinheiro — paga só pelo tempo de execução.' },
      { key: 'd', label: 'Editar texto colaborativamente', correct: false, why: 'Lambda é compute serverless, não editor.' },
    ],
  },
  {
    id: 'db',
    op: 'BANCO',
    color: 'violet',
    sql: 'Database · conceito',
    prompt: 'O que é um banco de dados?',
    options: [
      { key: 'a', label: 'Lugar onde se guarda dinheiro', correct: false, why: 'Isso é banco financeiro 😄' },
      { key: 'b', label: 'Lugar organizado pra guardar informações', correct: true,
        why: 'É um lugar organizado pra guardar informações. Pense numa planilha gigante: cada linha é um dado, cada coluna é uma característica desse dado.' },
      { key: 'c', label: 'Tipo de impressora', correct: false, why: 'Não.' },
      { key: 'd', label: 'Linguagem de programação', correct: false, why: 'A linguagem que conversa com o banco é o SQL — o banco em si é o lugar onde os dados moram.' },
    ],
  },
  {
    id: 'sql',
    op: 'SQL',
    color: 'emerald',
    sql: 'Structured Query Language',
    prompt: 'O que é SQL?',
    options: [
      { key: 'a', label: 'Sistema operacional', correct: false, why: 'Não — SQL é linguagem.' },
      { key: 'b', label: 'Linguagem usada pra conversar com bancos de dados', correct: true,
        why: 'SQL é a linguagem usada pra conversar com bancos. Com ela você busca, adiciona, edita ou apaga informações. Essencial pra qualquer sistema que use dados.' },
      { key: 'c', label: 'Marca de servidor físico', correct: false, why: 'Não — SQL é linguagem, não hardware.' },
      { key: 'd', label: 'Browser de internet', correct: false, why: 'Não.' },
    ],
  },
  {
    id: 'select',
    op: 'SELECT',
    color: 'cyan',
    sql: 'SELECT * FROM tabela',
    prompt: 'O que faz o comando SELECT?',
    options: [
      { key: 'a', label: 'Apaga dados', correct: false, why: 'Isso é DELETE.' },
      { key: 'b', label: 'Atualiza dados', correct: false, why: 'Isso é UPDATE.' },
      { key: 'c', label: 'Cria nova tabela', correct: false, why: 'Isso é CREATE TABLE.' },
      { key: 'd', label: 'Busca informações no banco', correct: true,
        why: 'SELECT serve pra buscar informações. É como fazer uma pergunta ao banco: "me mostre todos os usuários" ou "me mostre os pedidos de hoje".' },
    ],
  },
  {
    id: 'insert',
    op: 'INSERT',
    color: 'emerald',
    sql: 'INSERT INTO tabela VALUES (...)',
    prompt: 'O que faz o comando INSERT?',
    options: [
      { key: 'a', label: 'Adiciona novos dados ao banco', correct: true,
        why: 'INSERT adiciona dados novos. Por exemplo, cadastrar um novo usuário ou salvar uma compra recém-feita.' },
      { key: 'b', label: 'Remove linhas', correct: false, why: 'Isso é DELETE.' },
      { key: 'c', label: 'Edita uma linha existente', correct: false, why: 'Isso é UPDATE.' },
      { key: 'd', label: 'Lista linhas', correct: false, why: 'Isso é SELECT.' },
    ],
  },
  {
    id: 'update',
    op: 'UPDATE',
    color: 'amber',
    sql: 'UPDATE tabela SET ... WHERE',
    prompt: 'O que faz o comando UPDATE?',
    options: [
      { key: 'a', label: 'Cria novas linhas', correct: false, why: 'Isso é INSERT.' },
      { key: 'b', label: 'Modifica dados existentes', correct: true,
        why: 'UPDATE modifica dados que já existem. Por exemplo, mudar o nome ou o email de um usuário. Combine com WHERE pra não atualizar TUDO de uma vez.' },
      { key: 'c', label: 'Apaga uma tabela inteira', correct: false, why: 'Isso é DROP TABLE — bem mais destrutivo.' },
      { key: 'd', label: 'Conta quantas linhas existem', correct: false, why: 'Isso é SELECT COUNT(*).' },
    ],
  },
  {
    id: 'delete',
    op: 'DELETE',
    color: 'rose',
    sql: 'DELETE FROM tabela WHERE',
    prompt: 'O que faz o comando DELETE?',
    options: [
      { key: 'a', label: 'Cria registros', correct: false, why: 'Isso é INSERT.' },
      { key: 'b', label: 'Atualiza valores', correct: false, why: 'Isso é UPDATE.' },
      { key: 'c', label: 'Remove dados do banco', correct: true,
        why: 'DELETE remove dados do banco. Cuidado: se usar sem WHERE, pode apagar TUDO — bug clássico em produção.' },
      { key: 'd', label: 'Faz backup do banco', correct: false, why: 'Backup é um processo separado (mysqldump, snapshots etc).' },
    ],
  },
  {
    id: 'where',
    op: 'WHERE',
    color: 'cyan',
    sql: 'SELECT ... WHERE condição',
    prompt: 'Pra que serve o WHERE?',
    options: [
      { key: 'a', label: 'Cria uma tabela nova', correct: false, why: 'Isso é CREATE TABLE.' },
      { key: 'b', label: 'Filtra dados — define uma condição', correct: true,
        why: 'WHERE serve pra filtrar dados — define uma condição. Exemplo: "mostrar apenas usuários com idade maior que 18". Sem ele, a operação afeta TODAS as linhas.' },
      { key: 'c', label: 'Ordena resultados', correct: false, why: 'Isso é ORDER BY.' },
      { key: 'd', label: 'Junta tabelas', correct: false, why: 'Isso é JOIN.' },
    ],
  },
  {
    id: 'join',
    op: 'JOIN',
    color: 'violet',
    sql: 'SELECT ... JOIN ... ON ...',
    prompt: 'O que faz o JOIN?',
    options: [
      { key: 'a', label: 'Cria índice', correct: false, why: 'Isso é CREATE INDEX.' },
      { key: 'b', label: 'Junta informações de duas tabelas', correct: true,
        why: 'JOIN junta informações de duas tabelas diferentes. Exemplo clássico: juntar dados de usuários com seus pedidos numa só consulta.' },
      { key: 'c', label: 'Apaga uma tabela', correct: false, why: 'Isso é DROP TABLE.' },
      { key: 'd', label: 'Cria backup', correct: false, why: 'Não.' },
    ],
  },
  {
    id: 'pk',
    op: 'PRIMARY KEY',
    color: 'amber',
    sql: 'PRIMARY KEY (id)',
    prompt: 'O que é PRIMARY KEY?',
    options: [
      { key: 'a', label: 'Valor que pode se repetir entre linhas', correct: false, why: 'O contrário — PK NÃO pode repetir.' },
      { key: 'b', label: 'Identificador único de cada registro', correct: true,
        why: 'PRIMARY KEY é o identificador único de cada registro. É como o CPF de uma pessoa: não pode se repetir.' },
      { key: 'c', label: 'Senha do banco', correct: false, why: 'Não. Senha é credencial de acesso, não estrutura de tabela.' },
      { key: 'd', label: 'Tipo numérico exclusivo', correct: false, why: 'PK pode ser de vários tipos (int, uuid, string). O que importa é a unicidade.' },
    ],
  },
  {
    id: 'fk',
    op: 'FOREIGN KEY',
    color: 'violet',
    sql: 'FOREIGN KEY (user_id) REFERENCES users(id)',
    prompt: 'O que é FOREIGN KEY?',
    options: [
      { key: 'a', label: 'Chave estrangeira de outro país', correct: false, why: 'Não tem nada a ver com país 😄' },
      { key: 'b', label: 'Ligação entre tabelas — conecta dados relacionados', correct: true,
        why: 'FOREIGN KEY é uma ligação entre tabelas. Conecta dados relacionados — por exemplo, um pedido ligado a um usuário pelo user_id.' },
      { key: 'c', label: 'Tipo de criptografia de senha', correct: false, why: 'Não — isso é hashing/encryption.' },
      { key: 'd', label: 'Backup automático', correct: false, why: 'Não.' },
    ],
  },
  {
    id: 'rds',
    op: 'RDS',
    color: 'emerald',
    sql: 'AWS RDS · Managed DB',
    prompt: 'O que é Amazon RDS?',
    options: [
      { key: 'a', label: 'Editor de imagens', correct: false, why: 'Não.' },
      { key: 'b', label: 'Servidor de jogos online', correct: false, why: 'Não — isso seria GameLift, e mesmo assim diferente.' },
      { key: 'c', label: 'Serviço da AWS que cuida de bancos SQL pra você', correct: true,
        why: 'RDS é o serviço da AWS que cuida do banco de dados pra você. Faz backup, manutenção, atualização de versão — tudo automatizado pra bancos SQL (MySQL, Postgres, etc).' },
      { key: 'd', label: 'Storage de arquivos grandes', correct: false, why: 'Isso é S3.' },
    ],
  },
  {
    id: 'scale',
    op: 'ESCALA',
    color: 'cyan',
    sql: 'Scalability · conceito',
    prompt: 'O que é escalabilidade?',
    options: [
      { key: 'a', label: 'Capacidade de crescer quando necessário', correct: true,
        why: 'Escalabilidade é a capacidade de crescer conforme a demanda. Um sistema que aguenta 10 usuários pode crescer pra aguentar 10 mil — automaticamente, idealmente.' },
      { key: 'b', label: 'Tipo de gráfico de relatório', correct: false, why: 'Não.' },
      { key: 'c', label: 'Nível de segurança de criptografia', correct: false, why: 'Não — isso é segurança/encryption.' },
      { key: 'd', label: 'Modelo de cobrança da AWS', correct: false, why: 'Não — isso é pricing.' },
    ],
  },
  {
    id: 'iam',
    op: 'IAM',
    color: 'rose',
    sql: 'AWS IAM · Identity & Access',
    prompt: 'Pra que serve o AWS IAM?',
    options: [
      { key: 'a', label: 'Controla quem pode acessar o quê na AWS', correct: true,
        why: 'IAM (Identity and Access Management) controla quem pode acessar o quê dentro da AWS. É o sistema de permissões — usuários, grupos, roles, policies.' },
      { key: 'b', label: 'Compacta arquivos automaticamente', correct: false, why: 'Não.' },
      { key: 'c', label: 'Hospeda sites estáticos', correct: false, why: 'Isso é S3 + CloudFront.' },
      { key: 'd', label: 'Roda containers Docker', correct: false, why: 'Isso é ECS/EKS/Fargate.' },
    ],
  },
  {
    id: 'index',
    op: 'ÍNDICE',
    color: 'emerald',
    sql: 'CREATE INDEX idx_x ON tabela(col)',
    prompt: 'Pra que serve um índice em SQL?',
    options: [
      { key: 'a', label: 'Pra deixar as buscas mais rápidas', correct: true,
        why: 'Índice deixa buscas mais rápidas. É como o índice de um livro: te ajuda a achar uma página direto, sem ler o livro inteiro. O custo é gravação um pouco mais lenta.' },
      { key: 'b', label: 'Pra apagar tabelas em massa', correct: false, why: 'Isso é DELETE/TRUNCATE.' },
      { key: 'c', label: 'Pra criptografar dados', correct: false, why: 'Não — isso é encryption.' },
      { key: 'd', label: 'Pra fazer backup automático', correct: false, why: 'Não.' },
    ],
  },
  {
    id: 'tx',
    op: 'TRANSAÇÃO',
    color: 'violet',
    sql: 'BEGIN; ... COMMIT/ROLLBACK',
    prompt: 'O que é uma transação em SQL?',
    options: [
      { key: 'a', label: 'Pagamento online', correct: false, why: 'Esse é o sentido cotidiano da palavra — em SQL é diferente.' },
      { key: 'b', label: 'Conjunto de ações que devem acontecer juntas', correct: true,
        why: 'Transação é um conjunto de ações que devem acontecer juntas. Se algo der errado no meio, TUDO volta ao estado anterior (rollback). Garante integridade dos dados.' },
      { key: 'c', label: 'Conexão de rede com o banco', correct: false, why: 'Não — isso é connection/socket.' },
      { key: 'd', label: 'Permissão de usuário', correct: false, why: 'Isso é GRANT/REVOKE / IAM.' },
    ],
  },
  {
    id: 'null',
    op: 'NULL',
    color: 'cyan',
    sql: 'col IS NULL',
    prompt: 'O que significa NULL em SQL?',
    options: [
      { key: 'a', label: 'Zero (0)', correct: false, why: 'Zero é um valor — NULL é AUSÊNCIA de valor. Não é a mesma coisa.' },
      { key: 'b', label: 'String vazia ""', correct: false, why: 'String vazia também é um valor (uma string de tamanho 0). NULL é diferente.' },
      { key: 'c', label: 'Falso (boolean false)', correct: false, why: 'Não — falso é um valor booleano. NULL é ausência.' },
      { key: 'd', label: 'Ausência de valor — não foi preenchido', correct: true,
        why: 'NULL significa que o valor não existe ou não foi preenchido. Não é zero, nem string vazia, nem falso — é AUSÊNCIA de informação. Por isso usa "IS NULL" pra checar, nunca "= NULL".' },
    ],
  },
  {
    id: 'groupby',
    op: 'GROUP BY',
    color: 'emerald',
    sql: 'SELECT ... GROUP BY col',
    prompt: 'Pra que serve GROUP BY?',
    options: [
      { key: 'a', label: 'Apagar grupos de dados', correct: false, why: 'Não — GROUP BY agrupa pra ler/agregar, não pra apagar.' },
      { key: 'b', label: 'Ordenar resultados', correct: false, why: 'Isso é ORDER BY.' },
      { key: 'c', label: 'Agrupar dados pra análise', correct: true,
        why: 'GROUP BY agrupa dados pra análise. Exemplo clássico: contar quantos pedidos cada usuário fez. Costuma vir junto com COUNT, SUM, AVG e companhia.' },
      { key: 'd', label: 'Criar nova tabela vazia', correct: false, why: 'Isso é CREATE TABLE.' },
    ],
  },
  {
    id: 'orderby',
    op: 'ORDER BY',
    color: 'cyan',
    sql: 'SELECT ... ORDER BY col DESC',
    prompt: 'Pra que serve ORDER BY?',
    options: [
      { key: 'a', label: 'Filtrar linhas por condição', correct: false, why: 'Isso é WHERE.' },
      { key: 'b', label: 'Organizar resultados (ASC/DESC)', correct: true,
        why: 'ORDER BY organiza os resultados — pode ser ASC (menor pra maior) ou DESC (maior pra menor). Não muda os dados, só a ordem em que são retornados.' },
      { key: 'c', label: 'Criar índice', correct: false, why: 'Isso é CREATE INDEX. Mas índices ajudam ORDER BY a ser rápido!' },
      { key: 'd', label: 'Apagar dados em ordem', correct: false, why: 'Não.' },
    ],
  },
  {
    id: 'dynamo',
    op: 'DYNAMODB',
    color: 'violet',
    sql: 'AWS DynamoDB · NoSQL',
    prompt: 'O que é Amazon DynamoDB?',
    options: [
      { key: 'a', label: 'Banco SQL relacional como MySQL', correct: false, why: 'Não — DynamoDB é NoSQL, sem tabelas relacionais tradicionais.' },
      { key: 'b', label: 'Servidor virtual como EC2', correct: false, why: 'Isso é EC2.' },
      { key: 'c', label: 'Banco NoSQL muito rápido pra grandes volumes', correct: true,
        why: 'DynamoDB é um banco diferente do SQL. Não usa tabelas relacionais tradicionais e é muito rápido pra grandes volumes de dados — escalonamento automático e latência de milissegundos.' },
      { key: 'd', label: 'Editor de imagens', correct: false, why: 'Não.' },
    ],
  },
  {
    id: 'sqlnosql',
    op: 'SQL × NoSQL',
    color: 'rose',
    sql: 'comparativo',
    prompt: 'Qual a diferença entre SQL e NoSQL?',
    options: [
      { key: 'a', label: 'SQL = tabelas/relacionamentos; NoSQL = mais flexível, sem estrutura fixa', correct: true,
        why: 'SQL usa tabelas organizadas e relacionamentos entre dados. NoSQL é mais flexível e não precisa seguir uma estrutura fixa. SQL brilha pra dados organizados/transacionais; NoSQL pra grandes volumes e alta velocidade.' },
      { key: 'b', label: 'São iguais, só nome diferente', correct: false, why: 'São bem diferentes — estrutura, query, tradeoffs.' },
      { key: 'c', label: 'NoSQL roda só local; SQL só na nuvem', correct: false, why: 'Os dois rodam em qualquer lugar (local ou nuvem).' },
      { key: 'd', label: 'SQL não suporta JOIN; NoSQL sim', correct: false, why: 'Inverso! SQL é justamente bom em JOIN. Em NoSQL você costuma desnormalizar.' },
    ],
  },
];

// Sorteio Fisher-Yates parcial: pega N únicos do array sem repetir.
function pickRandom(arr, n) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0 && out.length - i < n; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.slice(-n);
}

function Question({ q, index, total, onAnswer }) {
  const [picked, setPicked] = useState(null);
  const cm = COLOR_MAP[q.color] || COLOR_MAP.cyan;

  const choose = (opt) => {
    if (picked) return;
    setPicked(opt);
    setTimeout(() => onAnswer(opt.correct), 1700);
  };

  return (
    <motion.div
      key={q.id}
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className={`px-2 py-0.5 rounded border ${cm.ring} ${cm.bg} ${cm.fg} font-mono text-[11px] font-bold`}>
          {q.op}
        </span>
        <span className="text-[10px] font-mono text-slate-500">
          {index + 1} / {total}
        </span>
      </div>
      <div className="text-[10px] font-mono text-slate-500 mb-1">contexto</div>
      <code className={`block ${cm.fg} font-mono text-xs mb-3 px-2 py-1 rounded ${cm.bg} border ${cm.ring}`}>
        {q.sql}
      </code>
      <p className="text-slate-200 text-sm leading-relaxed mb-4">{q.prompt}</p>

      <div className="space-y-2">
        {q.options.map((o) => {
          const isPicked = picked?.key === o.key;
          const isWrong = isPicked && !o.correct;
          const isRight = isPicked && o.correct;
          const showCorrect = picked && !isPicked && o.correct;
          return (
            <button
              key={o.key}
              onClick={() => choose(o)}
              disabled={!!picked}
              className={`w-full text-left px-3 py-2 rounded-lg border font-mono text-xs transition-colors flex items-center gap-2 ${
                isRight ? 'border-emerald-400/60 bg-emerald-400/15 text-emerald-200'
                : isWrong ? 'border-rose-400/60 bg-rose-400/15 text-rose-200'
                : showCorrect ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
                : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/30 hover:bg-white/[0.06]'
              }`}
            >
              <span className="font-bold opacity-60">{o.key.toUpperCase()}.</span>
              <span className="flex-1">{o.label}</span>
              {isRight && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              {isWrong && <XCircle className="w-4 h-4 text-rose-400" />}
              {showCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-400/70" />}
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {picked && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`mt-4 p-3 rounded-lg border text-xs leading-relaxed ${
              picked.correct
                ? 'border-emerald-400/30 bg-emerald-400/5 text-emerald-100'
                : 'border-rose-400/30 bg-rose-400/5 text-rose-100'
            }`}
          >
            <div className="flex items-center gap-2 font-mono font-bold mb-1">
              {picked.correct ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              {picked.correct ? 'Mandou bem!' : 'Quase!'}
            </div>
            {picked.why}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ResultScreen({ score, total, name, onClose }) {
  const pct = Math.round((score / total) * 100);
  const tier =
    score === total       ? { label: 'Mestre do CRUD',  color: 'violet', emoji: '🏆' } :
    score >= total - 1    ? { label: 'CRUD Avançado',   color: 'amber',  emoji: '🥈' } :
    score >= Math.ceil(total / 2) ? { label: 'CRUD Júnior', color: 'cyan', emoji: '🥉' } :
                            { label: 'Aprendiz',         color: 'rose',   emoji: '📘' };
  const cm = COLOR_MAP[tier.color];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 280, damping: 26 }}
      className="text-center"
    >
      <div className="text-5xl mb-2">{tier.emoji}</div>
      <h3 className="font-mono text-lg text-cyan-200 mb-1">
        {score === total ? `Perfeito, ${name}!` : `Tá indo bem, ${name}!`}
      </h3>
      <p className="text-slate-400 text-xs font-mono mb-4">
        {score} / {total} respostas certas · {pct}%
      </p>

      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border ${cm.ring} ${cm.bg} mb-5`}>
        <Award className={`w-4 h-4 ${cm.fg}`} />
        <span className={`font-mono text-sm font-bold ${cm.fg}`}>BADGE: {tier.label}</span>
      </div>

      <p className="text-slate-300 text-xs leading-relaxed mb-5">
        Você desbloqueou o sandbox livre — agora é só explorar. Cada CREATE, READ, UPDATE e DELETE
        que você fizer roda <strong>SQL real</strong> num MySQL na AWS. 🇺🇸
      </p>

      <button
        onClick={onClose}
        className="w-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/30 transition-colors rounded-lg py-2.5 font-mono text-sm flex items-center justify-center gap-2"
      >
        <Sparkles className="w-4 h-4" /> jogar livre
      </button>
    </motion.div>
  );
}

export default function QuizModal({ open, name, onClose }) {
  // Sorteia 5 perguntas únicas do pool — uma vez no mount do componente.
  // Como o QuizModal só "abre" 1× por sessão (gated por QUIZ_DONE_KEY no parent),
  // useMemo aqui é estável até o page reload — o que nos dá um conjunto novo a cada
  // reload, mas estável durante a partida (não muda enquanto o user joga).
  const questions = useMemo(() => pickRandom(QUESTION_POOL, QUESTIONS_PER_RUN), []);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const onAnswer = (correct) => {
    if (correct) setScore((s) => s + 1);
    if (idx + 1 < questions.length) {
      setIdx((i) => i + 1);
    } else {
      setDone(true);
    }
  };

  const handleClose = () => {
    try { sessionStorage.setItem(QUIZ_DONE_KEY, '1'); } catch { }
    onClose();
  };

  if (!open) return null;

  const q = questions[idx];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
        className="glass rounded-2xl p-5 sm:p-6 max-w-md w-full max-h-[90vh] overflow-auto shadow-[0_30px_120px_rgba(0,0,0,0.6)]"
      >
        {!done && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-cyan-300" />
              <h2 className="font-mono text-base text-cyan-300">Quiz Final · CRUD + AWS</h2>
            </div>
            <p className="text-[11px] font-mono text-slate-400">
              {questions.length} perguntas sorteadas. Sem pressão — é pra fixar conceito.
            </p>
            <div className="mt-2 h-1 bg-white/5 rounded overflow-hidden">
              <motion.div
                className="h-full bg-cyan-400/70"
                initial={{ width: 0 }}
                animate={{ width: `${(idx / questions.length) * 100}%` }}
                transition={{ duration: 0.25 }}
              />
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {!done ? (
            <Question key={q.id} q={q} index={idx} total={questions.length} onAnswer={onAnswer} />
          ) : (
            <ResultScreen key="result" score={score} total={questions.length} name={name || 'jogador'} onClose={handleClose} />
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
