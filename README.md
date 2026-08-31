# Chá de Panela — Henrique e marry

Site estático + Supabase para lista de presentes.

## O que já funciona

- Lista de presentes dinâmica
- Cadastro de produtos pelo painel administrativo
- Categorias
- Link para Amazon/outra loja
- Opção de presentear via PIX
- Reserva por 24 horas
- Produto fica indisponível assim que é reservado
- Confirmação de compra em loja pelo convidado
- Aviso de PIX realizado
- Nome do convidado visível apenas no painel autenticado
- Admin pode confirmar, liberar ou excluir presentes
- Foto de infância incluída como decoração
- Compatível com GitHub Pages

---

# 1. Criar o projeto no Supabase

1. Entre em https://supabase.com e crie um projeto.
2. Abra o projeto.
3. Vá em **SQL Editor**.
4. Clique em **New query**.
5. Abra o arquivo `supabase.sql` deste projeto.
6. Copie todo o conteúdo, cole no SQL Editor e clique em **Run**.

Isso cria:
- `products`
- `reservations`
- políticas RLS
- funções de reserva/PIX/confirmação
- alguns produtos de exemplo

---

# 2. Criar o usuário administrador

No Supabase:

1. Vá em **Authentication**.
2. Abra **Users**.
3. Crie manualmente o seu usuário administrativo com e-mail e senha.
4. Nas configurações de autenticação, desative cadastro público de novos usuários.

IMPORTANTE: o painel considera usuários autenticados como administradores.
Por isso, não deixe visitantes criarem contas.

---

# 3. Pegar URL e chave pública do Supabase

No painel do projeto, procure as configurações de API / Data API.

Você precisa de:
- Project URL
- Publishable key (ou anon key em projetos que ainda exibem esse nome)

Abra:

`js/config.js`

e troque:

```js
SUPABASE_URL: "COLE_SUA_SUPABASE_URL_AQUI",
SUPABASE_KEY: "COLE_SUA_PUBLISHABLE_KEY_AQUI",
```

Também troque:

```js
PIX_KEY: "SUA-CHAVE-PIX",
PIX_HOLDER: "NOME DO TITULAR",
```

NUNCA coloque a chave `service_role` no site.

---

# 4. Personalizar nomes e evento

Abra `index.html`.

Procure por:

`João & Nome`

e troque pelo nome do casal.

Também altere:
- data
- local
- textos que desejar

A foto enviada já está em:

`assets/casal-infancia.png`

---

# 5. Testar antes de publicar

Como o site consulta o Supabase, prefira abrir com um servidor local.

No VS Code, você pode instalar a extensão **Live Server**.

Depois:
1. abra a pasta do projeto no VS Code;
2. clique com botão direito em `index.html`;
3. escolha **Open with Live Server**.

Teste:
- lista de presentes;
- reserva;
- PIX;
- link de loja;
- `admin.html`;
- login;
- cadastro de presente;
- confirmação/liberação.

---

# 6. Hospedar no GitHub Pages pelo navegador

## Criar repositório

1. Acesse GitHub.
2. Clique em **New repository**.
3. Sugestão de nome: `cha-de-panela`.
4. Deixe público se estiver usando GitHub Free.
5. Crie o repositório.

## Enviar arquivos

1. Abra o repositório.
2. Clique em **Add file > Upload files**.
3. Envie TODO o conteúdo desta pasta mantendo a estrutura:
   - `index.html`
   - `admin.html`
   - `supabase.sql`
   - `css/`
   - `js/`
   - `assets/`
4. Faça o commit.

IMPORTANTE:
`index.html` precisa ficar na raiz do repositório, e não dentro de outra pasta.

## Ativar Pages

1. Dentro do repositório abra **Settings**.
2. No menu lateral abra **Pages**.
3. Em **Build and deployment**:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/(root)`
4. Clique em **Save**.

Depois do deploy, seu endereço normalmente será:

`https://SEU-USUARIO.github.io/cha-de-panela/`

O painel ficará em:

`https://SEU-USUARIO.github.io/cha-de-panela/admin.html`

---

# Segurança

É normal a chave pública/anon do Supabase aparecer no JavaScript.
A proteção real é feita pelo banco usando RLS e pelas funções SQL.

Nunca publique:
- senha do administrador
- service_role key
- credenciais bancárias além da chave PIX que você deliberadamente quer mostrar

O nome de quem presenteou fica em `reservations`, cuja leitura pública está bloqueada pelas políticas RLS.

---

# Fluxo do convidado

1. Escolhe um presente.
2. Digita o nome.
3. Escolhe loja ou PIX.
4. Produto vira reservado.
5. Ninguém mais consegue escolher o mesmo produto.
6. Loja:
   - abre a loja
   - convidado volta e marca que comprou
7. PIX:
   - copia a chave
   - envia o valor
   - avisa no site que fez o PIX
   - administrador confirma depois de conferir o banco

Reservas não confirmadas expiram em 24 horas quando o site volta a consultar o banco.

---

# Próximas melhorias possíveis

- upload de imagem no Supabase Storage
- QR Code PIX
- edição de produtos no painel
- contador para o evento
- confirmação automática de PIX com gateway de pagamento
- domínio próprio
