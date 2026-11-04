# KALI no ar de graça (Oracle Cloud + DuckDNS + HTTPS)

Custo: **R$ 0**. No fim você tem um endereço tipo `https://suakali.duckdns.org`, com microfone, tela, notificação e o app Android funcionando.

---

## 1. Endereço grátis (DuckDNS) — 2 min
1. Entra em **https://www.duckdns.org** e faz login (Google, GitHub ou Discord).
2. Em **sub domain**, digita o nome (ex.: `suakali`) e clica **add domain**.
3. Deixa a página aberta: depois você cola o IP do servidor ali.
4. Anota o **token** que aparece no topo.

## 2. Servidor grátis (Oracle Cloud Free) — 15 min
1. Cria a conta em **https://www.oracle.com/cloud/free/** (pede cartão só pra conferir, não cobra nada no plano Always Free). Região: **Brazil East (São Paulo)** ou **Vinhedo**.
2. No painel: **Compute → Instances → Create instance**.
   - **Image:** Ubuntu 22.04 (ou 24.04).
   - **Shape:** *Change shape* → **Ampere (ARM) VM.Standard.A1.Flex** → 2 OCPUs e 12 GB (é grátis até 4 OCPUs / 24 GB).
   - **SSH keys:** *Generate a key pair* e **baixa a chave privada** (guarda bem).
   - Clica **Create**. Se der "Out of capacity", tenta 1 OCPU / 6 GB ou outra hora do dia.
3. Quando ficar verde (Running), copia o **Public IP address**.
4. Volta no DuckDNS, cola o IP no seu domínio e clica **update ip**.

## 3. Abrir as portas 80 e 443 — 3 min
Na Oracle são **dois lugares**:
1. Na página da instância → clica na **Subnet** → **Default Security List** → **Add Ingress Rules**:
   - Source CIDR `0.0.0.0/0`, Destination port **80** → Add.
   - De novo com a porta **443**.
2. No próprio servidor (passo 4), roda também:
   ```bash
   sudo iptables -I INPUT 6 -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT 6 -p tcp --dport 443 -j ACCEPT
   sudo netfilter-persistent save
   ```

## 4. Entrar no servidor e instalar — 10 min
No Windows, abre o **PowerShell** na pasta onde baixou a chave:
```bash
ssh -i ssh-key.key ubuntu@SEU_IP
```
(Se reclamar da permissão da chave: botão direito na chave → Propriedades → Segurança → deixa só o seu usuário.)

Já dentro do servidor:
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu && newgrp docker
git clone https://github.com/kaliorg01/kali.git
cd kali
```
Agora sobe a KALI com HTTPS (troca pelo seu domínio):
```bash
DOMINIO=suakali.duckdns.org docker compose -f docker-compose.gratis.yml up -d --build
```
Em 1 a 2 minutos abre **https://suakali.duckdns.org** e cria sua conta.

> Pra virar dono da loja/app: `echo seu_usuario > dados/admins.txt` e `docker compose -f docker-compose.gratis.yml restart kali`.

## 5. App Android baixável
1. No GitHub do projeto: **Settings → Secrets and variables → Actions → Variables → New variable**
   - Nome `KALI_URL`, valor `https://suakali.duckdns.org`
2. Aba **Actions → App Android → Run workflow**.
3. Em uns 5 minutos o botão **"Baixar app"** da KALI já entrega o `KALI.apk`.

## 6. Atualizar quando sair novidade
```bash
cd ~/kali && git pull && DOMINIO=suakali.duckdns.org docker compose -f docker-compose.gratis.yml up -d --build
```

## 7. Backup (recomendado 1x por semana)
```bash
cd ~/kali && docker compose -f docker-compose.gratis.yml stop kali
tar czf ~/backup-kali-$(date +%F).tgz dados
docker compose -f docker-compose.gratis.yml start kali
```

---

### Deu ruim?
- **Site não abre:** confere as portas 80/443 (passo 3, os dois lugares) e se o IP no DuckDNS é o da instância.
- **"Certificado inválido" nos primeiros minutos:** espera 2 min, o Caddy ainda está pegando o certificado. Ver: `docker logs kali-https`.
- **Erro na KALI:** `docker logs kali`.
- **Oracle desligou a instância por "ociosa":** acontece raramente no Free; é só dar Start de novo (os dados ficam).
