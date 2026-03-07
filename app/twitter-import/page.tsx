'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { CheckCircle, ChevronRight, Copy, Check, Settings } from 'lucide-react'

// The bookmarklet is built dynamically with the current Siftly origin so it works
// both locally (http://localhost:3000) and in production (https://siftly-eight.vercel.app).
function buildBookmarklet(siftlyOrigin: string): string {
  return `javascript:(async()=>{const csrf=document.cookie.match(/ct0=([^;]+)/)?.[1];if(!csrf){alert('Cookie ct0 não encontrado. Certifique-se de estar em x.com e logado.');return;}const BEARER='AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I%2BxMb1nYFAA%3DUognEfK4ZPxYowpr4nMskopkC%2FDO';const QID='j5KExFXy1niL_uGnBhHNxA';const FEAT=JSON.stringify({graphql_timeline_v2_bookmark_timeline:true,responsive_web_graphql_exclude_directive_enabled:true,verified_phone_label_enabled:false,creator_subscriptions_tweet_preview_api_enabled:true,responsive_web_graphql_timeline_navigation_enabled:true,responsive_web_graphql_skip_user_profile_image_extensions_enabled:false,tweetypie_unmention_optimization_enabled:true,responsive_web_edit_tweet_api_enabled:true,graphql_is_translatable_rweb_tweet_is_translatable_enabled:true,view_counts_everywhere_api_enabled:true,longform_notetweets_consumption_enabled:true,responsive_web_twitter_article_tweet_consumption_enabled:false,tweet_awards_web_tipping_enabled:false,freedom_of_speech_not_reach_fetch_enabled:true,standardized_nudges_misinfo:true,tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled:true,longform_notetweets_rich_text_read_enabled:true,longform_notetweets_inline_media_enabled:true,responsive_web_enhance_cards_enabled:false});const tweets=[];let cursor=null;let pages=0;const status=document.createElement('div');status.style.cssText='position:fixed;top:16px;right:16px;background:#1a1a2e;color:#a5b4fc;border:1px solid #4f46e5;padding:12px 18px;border-radius:12px;font-family:system-ui;font-size:14px;z-index:99999;box-shadow:0 4px 24px rgba(0,0,0,.4)';status.textContent='Siftly: buscando página 1…';document.body.appendChild(status);while(pages<200){const vars=JSON.stringify({count:100,includePromotedContent:false,...(cursor?{cursor}:{})});let data;try{const r=await fetch('/i/api/graphql/'+QID+'/Bookmarks?variables='+encodeURIComponent(vars)+'&features='+encodeURIComponent(FEAT),{credentials:'include',headers:{Authorization:'Bearer '+BEARER,'X-Csrf-Token':csrf}});if(!r.ok){status.remove();alert('Erro da API do X: '+r.status+'. O ID do query pode ter mudado — tente o bookmarklet mais recente no Siftly.');return;}data=await r.json();}catch(e){status.remove();alert('Erro de conexão: '+e.message);return;}const instructions=data?.data?.bookmark_timeline_v2?.timeline?.instructions??[];let nextCursor=null;let count=0;for(const inst of instructions){if(inst.type!=='TimelineAddEntries')continue;for(const entry of inst.entries??[]){const c=entry.content;if(c?.entryType==='TimelineTimelineItem'){const t=c?.itemContent?.tweet_results?.result;if(t?.rest_id){tweets.push(t);count++;}}else if(c?.entryType==='TimelineTimelineCursor'&&c?.cursorType==='Bottom'){nextCursor=c.value;}}}if(!nextCursor||count===0)break;cursor=nextCursor;pages++;status.textContent='Siftly: '+tweets.length+' bookmarks encontrados, carregando mais…';}status.textContent='Siftly: salvando '+tweets.length+' bookmarks…';if(tweets.length===0){status.remove();alert('Nenhum bookmark encontrado. Certifique-se de estar em x.com.');return;}try{const r=await fetch('${siftlyOrigin}/api/import/bookmarklet',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tweets})});const d=await r.json();status.remove();if(r.ok){fetch('${siftlyOrigin}/api/settings/twitter/ct0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ct0:csrf})}).catch(()=>{});alert('Concluído! '+d.imported+' bookmarks importados'+(d.skipped?' ('+d.skipped+' duplicatas ignoradas)':'')+'. Atualize o Siftly para ver.');}else{alert('Erro Siftly: '+d.error);}}catch(e){status.remove();alert('Não foi possível conectar ao Siftly em ${siftlyOrigin}. Está aberto?');}})();`
}

const STEPS = [
  { label: 'Copie o código', desc: 'Clique em "Copiar Bookmarklet" abaixo.' },
  { label: 'Crie um favorito no navegador', desc: 'Chrome: botão direito na barra de favoritos → "Adicionar página…". Firefox: menu Favoritos → "Novo Favorito".' },
  { label: 'Cole como URL', desc: 'Defina o nome como "Siftly Import" e cole o código como URL/Endereço.' },
  { label: 'Acesse x.com/i/bookmarks', desc: 'Certifique-se de estar logado no X.' },
  { label: 'Clique no seu favorito', desc: 'Ele busca todos os seus bookmarks e salva aqui automaticamente. Um popup confirmará quando concluído.' },
]

export default function TwitterImportPage() {
  const [copied, setCopied] = useState(false)
  const [success, setSuccess] = useState<{ imported: number; skipped: number } | null>(null)
  const [bookmarkletCode, setBookmarkletCode] = useState('')
  const linkRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    const origin = window.location.origin
    const code = buildBookmarklet(origin)
    setBookmarkletCode(code)
    if (linkRef.current) {
      linkRef.current.setAttribute('href', code)
    }
  }, [])

  function handleCopy() {
    if (!bookmarkletCode) return
    navigator.clipboard.writeText(bookmarkletCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">Importar Todos os Bookmarks — Grátis</h1>
        <p className="text-zinc-400 mt-1">
          Sem extensões, sem paywall. Um bookmarklet de um clique busca tudo direto do X.
        </p>
      </div>

      {/* Copy bookmarklet */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-4">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">
          Obtenha o Bookmarklet
        </h2>
        <p className="text-sm text-zinc-400 mb-5">
          Copie este código e cole como URL de um novo favorito no navegador.
        </p>

        <div className="flex gap-3 items-stretch">
          <div className="flex-1 px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-500 text-xs font-mono truncate flex items-center">
            javascript:(async()=&gt;&#123;const csrf=…&#125;)();
          </div>
          <button
            onClick={handleCopy}
            disabled={!bookmarkletCode}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition-colors shrink-0"
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? 'Copiado!' : 'Copiar Bookmarklet'}
          </button>
        </div>

        <p className="mt-3 text-xs text-zinc-600">
          Ou tente arrastar:{' '}
          <a
            ref={linkRef}
            href="#"
            className="text-indigo-400 underline cursor-grab"
            onClick={(e) => e.preventDefault()}
          >
            Siftly Import
          </a>{' '}
          para a barra de favoritos (pode não funcionar em todos os navegadores).
        </p>
      </div>

      {/* Steps */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-4">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">
          Como usar
        </h2>
        <ol className="space-y-4">
          {STEPS.map((step, i) => (
            <li key={i} className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-400 mt-0.5">
                {i + 1}
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-200">{step.label}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>

        <a
          href="https://x.com/i/bookmarks"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors"
        >
          Abrir x.com/i/bookmarks <ChevronRight size={14} />
        </a>
      </div>

      {/* Auto-sync CTA */}
      <div className="bg-zinc-900 border border-indigo-500/20 rounded-2xl p-6 mb-4">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-3">
          Sincronização Automática
        </h2>
        <p className="text-sm text-zinc-400 leading-relaxed mb-4">
          Quer que o Siftly busque seus novos bookmarks <strong className="text-zinc-200">automaticamente todo dia</strong>,
          sem precisar clicar no bookmarklet? Conecte sua conta X nas Configurações — é um setup
          de 1 minuto (copiar dois cookies do DevTools), e o sync roda às 05:00 BRT todo dia.
        </p>
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
        >
          <Settings size={14} />
          Configurar sync automático
        </Link>
      </div>

      {/* How it works */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-4">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-3">
          Como funciona
        </h2>
        <p className="text-sm text-zinc-400 leading-relaxed">
          O bookmarklet executa dentro do seu navegador no x.com, usando sua sessão de login existente.
          Ele chama a mesma API interna que o próprio site do X usa — sem senha, sem chave de API, sem extensão.
          Suas credenciais nunca saem do seu navegador. Todos os dados vão diretamente para sua instância do Siftly.
        </p>
      </div>

      {success && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          <CheckCircle size={16} />
          Importados <strong>{success.imported}</strong> bookmarks
          {success.skipped > 0 && `, ${success.skipped} duplicatas ignoradas`}.
          <Link href="/bookmarks" className="ml-auto flex items-center gap-1 text-indigo-400 hover:underline">
            Ver <ChevronRight size={13} />
          </Link>
        </div>
      )}
    </div>
  )
}
