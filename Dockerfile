# =============================================================================
# APPintura — build do SPA (Vite/React) e entrega por nginx.
#
# Duas etapas de propósito: o estágio `build` carrega Node, o npm e os ~300 MB
# de node_modules; a imagem final leva só os estáticos de `dist/` sobre nginx.
# =============================================================================

# ---- etapa 1: build ---------------------------------------------------------
FROM node:24-alpine AS build

WORKDIR /app

# As variáveis do Vite são resolvidas em tempo de BUILD e ficam embutidas no
# bundle — não adianta defini-las no runtime do container. Por isso entram como
# ARG aqui e precisam ser passadas pelo Dokploy como "Build Args", não como
# variáveis de ambiente do serviço.
#
# A anon key do Supabase é pública por natureza (vai no navegador de qualquer
# usuário); quem protege os dados é o RLS. A service_role NUNCA entra aqui.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Copiar só os manifestos antes do código faz o Docker reaproveitar a camada de
# dependências enquanto package-lock.json não mudar — a recompilação típica
# (só código) pula o npm ci inteiro.
COPY package.json package-lock.json ./

# `npm ci` e não `npm install`: instala exatamente o lockfile e falha se ele
# estiver dessincronizado, em vez de "consertar" sozinho e gerar um build
# diferente do que foi testado.
RUN npm ci

COPY . .

# `npm run build` = `tsc -b && vite build`. O tsc fica de propósito: erro de
# tipo derruba o build aqui, não em produção.
RUN npm run build

# ---- etapa 2: runtime -------------------------------------------------------
FROM nginx:1.29-alpine AS runtime

# Remove a página padrão do nginx para garantir que nada dela sobreviva a um
# build em que `dist/` venha vazio — melhor 404 do que "Welcome to nginx".
RUN rm -rf /usr/share/nginx/html/*

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# 127.0.0.1 e NÃO localhost: dentro da imagem, `localhost` resolve primeiro para
# `::1`, e o nginx aqui escuta só em IPv4 — o healthcheck falharia sempre, e no
# Swarm isso derruba e recria a task num loop infinito.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
