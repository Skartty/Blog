# Guia de estudo — blog com microserviços

React, Node.js, Express, JavaScript com ES Modules e `fetch`. Cada serviço guarda seus dados em memória; o Event Bus distribui eventos por HTTP.

## Serviços e portas

| Serviço | Pasta | Porta |
| --- | --- | --- |
| client-server | `client-server/` | 3000 |
| Posts | `posts/` | 4000 |
| Comments | `coments/` | 4001 |
| Query | `query/` | 4002 |
| Moderation | `moderation/` | 4003 |
| Event Bus | `event-bus/` | 4005 |

## Fluxo de criação de post

```text
client-server → Posts → PostCreated → Event Bus → Query
```


`POST :4000/posts` recebe `{ "title": "Título" }`. Posts gera o ID, salva em memória e publica o evento em `POST :4005/events`.

## Fluxo de comentário

```text
client-server → Comments → CommentCreated → Event Bus → Moderation
       → CommentModerated → Event Bus → Comments
       → CommentUpdated → Event Bus → Query
```

`POST :4001/posts/:postId/comments` recebe `{ "content": "Comentário" }`. Comments guarda o comentário como `pending`. Moderation analisa o conteúdo; Comments recebe a decisão, atualiza seu próprio registro e publica `CommentUpdated`.

O Event Bus entrega cada evento em `POST /events` de Posts, Comments, Query e Moderation. Cada consumidor trata somente os eventos relevantes. A moderação nunca chama Comments ou Query diretamente.

## Eventos

| Evento | Quem publica | Dados e finalidade |
| --- | --- | --- |
| `PostCreated` | Posts | `id`, `title`: cria o post no Query. |
| `CommentCreated` | Comments | `id`, `content`, `postId`, `status: 'pending'`, `reason: null`: adiciona o comentário no Query e dispara a moderação. |
| `CommentModerated` | Moderation | `id`, `content`, `postId`, `status`, `reason`: informa a decisão a Comments. |
| `CommentUpdated` | Comments | `id`, `content`, `postId`, `status`, `reason`: atualiza o comentário no Query. |

Os dados ficam diretamente no objeto do evento, sem uma propriedade `data`.

## Estados

- `pending`: existe internamente, fica fora da lista e o formulário mostra “Seu comentário está sendo verificado...”.
- `approved`: foi publicado; somente esse estado permite exibir o conteúdo e contar o comentário na lista.
- `rejected`: existe internamente, fica fora da lista e o formulário mostra a rejeição e seu motivo, sem o conteúdo recusado.

**Existir no sistema é diferente de estar publicado.** Comments e Query mantêm os estados em memória. `CommentList` sempre filtra `status === 'approved'`; mensagens de moderação pertencem ao formulário.

## Acompanhamento no frontend

```text
Enviar → feedback “verificando” → POST Comments → receber ID
       → GET :4001/comments/:commentId/status
       → pending: consultar novamente após 1 segundo
       → approved: parar, consultar Query e mostrar sucesso
       → rejected: parar e mostrar alerta com o motivo
```

O endpoint de status devolve apenas `{ id, status, reason }`, ou 404 se o comentário não existir. O formulário acompanha somente o comentário que acabou de enviar. As consultas param no resultado final ou em caso de erro; ao desmontar o formulário, o timer e a consulta em andamento são cancelados. O envio fica desabilitado durante a verificação.

Essa consulta não executa moderação: a decisão continua passando exclusivamente pelo Event Bus.

## Onde cada coisa está

| Arquivo | O que estudar |
| --- | --- |
| `posts/index.js` | ID, armazenamento de posts e publicação de `PostCreated`. |
| `coments/index.js` | `commentsByPostId`, criação pendente, consulta de status, tratamento de `CommentModerated` e publicação de `CommentUpdated`. |
| `moderation/index.js` | Regras, decisão e publicação de `CommentModerated`. |
| `query/index.js` | `const posts = {}`, modelo de leitura e tratamento de `PostCreated`, `CommentCreated` e `CommentUpdated`. |
| `event-bus/index.js` | Distribuição com `Promise.allSettled`, portas dos consumidores e registro de falhas. |
| `client-server/src/App.js` | Leitura do Query e callbacks para atualizar a lista após criar posts ou aprovar comentários. |
| `client-server/src/PostCreate/PostCreate.js` | Escrita em Posts. |
| `client-server/src/CommentCreate/CommentCreate.js` | Escrita em Comments, consulta de status e feedback de moderação. |
| `client-server/src/PostList/PostList.js` e `client-server/src/CommentList/CommentList.js` | Posts do Query e lista exclusiva de comentários aprovados. |

Query aceita `CommentUpdated` antes de `CommentCreated`: guarda o resultado final e evita duplicar ou voltar o comentário para `pending` se a criação chegar depois.

## Moderação

Altere estas listas no início de **`moderation/index.js`**:

```js
const blockedWords = ['idiota', 'spam'];
const blockedCharacters = ['@', '#'];
```

A busca usa `includes`: bloqueia também termos que contenham a sequência proibida. Palavras ignoram maiúsculas/minúsculas (`SPAM`, `Spam`, `spam`). O primeiro motivo encontrado é devolvido; palavras têm prioridade sobre caracteres.

## Independência

```text
Posts offline + Query online + Comments online
              + Moderation online + Event Bus online
```

O post já conhecido continua disponível em Query. Comments não consulta Posts para criar comentários; a moderação continua pelo Event Bus. Uma entrega para 4000 falha e aparece no console, mas `Promise.allSettled` permite entregar aos consumidores online. Cada entrega tem limite de 10 segundos para não aguardar indefinidamente um consumidor sem resposta.

**Lista pública:** client-server → `GET :4002/posts`. **Escrita:** client-server → Posts ou Comments. **Status do envio:** client-server → Comments. As respostas de criação aguardam a publicação dos eventos; a decisão pode já estar disponível quando o frontend recebe o ID.

Dados se perdem ao reiniciar o serviço que os guarda. Eventos enviados durante uma parada não são recuperados; não há banco, replay ou fila persistente.

## Como executar

Requer **Node.js 18 ou superior** para usar `fetch` nativo. Abra um terminal por serviço, entre na pasta indicada abaixo e execute:

```bash
npm install
npm start
```

Ordem sugerida, partindo de `blog/`: `event-bus/`, `posts/`, `coments/`, `query/`, `moderation/`, `client-server/`. Inicie todos antes de criar conteúdo. Os backends usam `node index.js`; nenhum precisa de nodemon global.

Abra [http://localhost:3000](http://localhost:3000). Para alterar um backend, encerre e execute `npm start` novamente.

## Roteiro de testes

1. Crie um post: deve aparecer sem recarregar a página.
2. Envie `Gostei muito desse conteúdo.`: o formulário deve mostrar a verificação, depois sucesso; somente após aprovação o comentário aparece.
3. Envie `Isso é spam`: o formulário deve mostrar rejeição e motivo; a lista e seu contador não mudam.
4. Envie um comentário com `@`: deve mostrar o motivo relacionado ao caractere. Teste também `SPAM`, `idiota` e `#`.
5. Encerre somente Posts com Ctrl+C no terminal dele. No post existente, envie um comentário permitido e um proibido: ambos devem ser processados; a falha em 4000 aparece no console do Event Bus.
6. Para observar `pending`, pare Moderation temporariamente e crie um comentário: aparece apenas o feedback de verificação, sem novo item na lista. Esse evento não será recuperado quando Moderation voltar; recarregue a página para encerrar esse acompanhamento antes de testar um novo envio.

No frontend, `npm test -- --watchAll=false` valida a interface; `npm run build` verifica a compilação.
