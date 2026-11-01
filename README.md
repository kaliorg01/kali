# AURA

App de comunidade em tempo real estilo Discord, 100% em português: servidores, canais, chat e voz.

## Como rodar

1. Instale o [Node.js 24+](https://nodejs.org)
2. Baixe o projeto (botão verde **Code → Download ZIP**, ou `git clone`)
3. Na pasta do projeto:

```bash
npm install
npm start
```

4. Abra http://localhost:3333 e crie sua conta.

## Usar junto com os amigos

Cada pessoa que roda o AURA tem um servidor próprio, separado dos outros. Pra conversar junto, **uma pessoa hospeda** e o resto entra pelo endereço dela:

- **Mesma rede (Wi‑Fi/LAN):** quem hospeda roda `npm start` e passa o IP local, ex.: `http://192.168.0.10:3333`
- **Pela internet:** suba numa VPS seguindo o [DEPLOY.md](DEPLOY.md) (Docker)

Os dados ficam em `dados/aura.db`, que é criado sozinho na primeira vez.
