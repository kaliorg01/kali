# Deploy Kali na VPS

## Requisitos na VPS
- Docker + Docker Compose
- Porta 3333 aberta no firewall

## 1. Suba o projeto na VPS
```bash
git clone <SEU_REPOSITORIO>
cd kali
cp .env.example .env
# edite .env se quiser mudar a porta
```

## 2. Rode com Docker Compose
```bash
docker compose up -d --build
```

## 3. Acesse
- Navegador: `http://<IP_DA_VPS>:3333`
- Seus amigos acessam pelo mesmo endereço

## 4. Comandos úteis
```bash
docker compose logs -f        # ver logs
docker compose down           # parar
docker compose restart        # reiniciar
```

## 5. Backup do banco
```bash
docker cp kali:/app/dados/kali.db ./backup-kali.db
```

## Sem Docker (direto no Node)
```bash
npm ci --omit=dev
PORT=3333 HOST=0.0.0.0 node server.js
```
