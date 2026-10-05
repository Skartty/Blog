import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App';
import CommentCreate from './CommentCreate/CommentCreate';
import CommentList from './CommentList/CommentList';

const originalFetch = global.fetch;
const jsonResponse = data => ({ ok: true, json: async () => data });
const post = { id: 'post1', title: 'Post existente', comments: [] };
const comment = { id: 'comment1', content: 'Gostei muito desse conteúdo.', status: 'pending', reason: null };
const statusUrl = 'http://localhost:4001/comments/comment1/status';

const flushUpdates = () => act(async () => { await Promise.resolve(); });

const submitComment = async (content = comment.content) => {
  fireEvent.change(screen.getByRole('textbox', { name: 'Comentário' }), {
    target: { value: content }
  });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
  await flushUpdates();
};

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.useRealTimers();
});

test('consulta o Query para leitura e mantém a interface atual', async () => {
  global.fetch.mockResolvedValue(jsonResponse({}));
  render(<App />);

  expect(screen.getByRole('heading', { name: 'Seu espaço para publicar.' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Publicar' })).toBeInTheDocument();
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('http://localhost:4002/posts'));
  expect(screen.getByText('Nenhuma publicação encontrada.')).toBeInTheDocument();
});

test('cria um post em Posts e apresenta os dados retornados pelo Query', async () => {
  global.fetch
    .mockResolvedValueOnce(jsonResponse({}))
    .mockResolvedValueOnce(jsonResponse(post))
    .mockResolvedValueOnce(jsonResponse({ post1: post }));
  render(<App />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

  fireEvent.change(screen.getByLabelText('Título'), { target: { value: post.title } });
  fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));

  expect(await screen.findByRole('heading', { name: post.title })).toBeInTheDocument();
  expect(global.fetch.mock.calls[1][0]).toBe('http://localhost:4000/posts');
  expect(JSON.parse(global.fetch.mock.calls[1][1].body)).toEqual({ title: post.title });
  expect(global.fetch.mock.calls[2]).toEqual(['http://localhost:4002/posts']);
});

test('CommentList exibe e conta apenas approved, mesmo recebendo todos os estados', () => {
  render(<CommentList comments={[
    { id: '1', content: 'Comentário aprovado', status: 'approved' },
    { id: '2', content: 'Texto ainda em análise', status: 'pending' },
    { id: '3', content: 'Isso é spam', status: 'rejected', reason: 'A palavra "spam" não é permitida.' },
    { id: '4', content: 'Contato @proibido', status: 'rejected', reason: 'O caractere "@" não é permitido.' },
    { id: '5', content: 'Sem status' }
  ]} />);

  expect(screen.getAllByRole('listitem')).toHaveLength(1);
  expect(screen.getByRole('listitem')).toHaveTextContent('Comentário aprovado');
  expect(screen.getByRole('heading')).toHaveTextContent('Comentários1');
  expect(screen.queryByText(/moderação|não publicado|spam|@proibido|Sem status/)).not.toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});

test('mostra verificação imediatamente, antes de receber a resposta de criação', async () => {
  let resolveCreation;
  global.fetch.mockReturnValue(new Promise(resolve => { resolveCreation = resolve; }));
  const onCommentApproved = jest.fn();
  const { unmount } = render(<CommentCreate postId={post.id} onCommentApproved={onCommentApproved} />);

  await submitComment();

  expect(screen.getByRole('status')).toHaveTextContent('Seu comentário está sendo verificado...');
  expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
  expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  expect(onCommentApproved).not.toHaveBeenCalled();

  global.fetch.mockResolvedValue(jsonResponse(comment));
  await act(async () => resolveCreation(jsonResponse(comment)));
  unmount();
});

test('pending mantém a lista; approved encerra consultas e atualiza a lista pelo Query', async () => {
  jest.useFakeTimers('legacy');
  const existing = { id: 'existing', content: 'Muito bom!', status: 'approved' };
  global.fetch
    .mockResolvedValueOnce(jsonResponse({ post1: { ...post, comments: [existing] } }))
    .mockResolvedValueOnce(jsonResponse(comment))
    .mockResolvedValueOnce(jsonResponse(comment))
    .mockResolvedValueOnce(jsonResponse({ ...comment, status: 'approved' }))
    .mockResolvedValueOnce(jsonResponse({ post1: { ...post, comments: [existing, { ...comment, status: 'approved' }] } }));
  render(<App />);
  await flushUpdates();

  await submitComment();

  expect(screen.getByRole('status')).toHaveTextContent('Seu comentário está sendo verificado...');
  expect(screen.getAllByRole('listitem')).toHaveLength(1);
  expect(screen.queryByText(comment.content)).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Comentário' })).toHaveValue('');
  expect(global.fetch.mock.calls[1][0]).toBe('http://localhost:4001/posts/post1/comments');
  expect(JSON.parse(global.fetch.mock.calls[1][1].body)).toEqual({ content: comment.content });
  expect(global.fetch.mock.calls[2][0]).toBe(statusUrl);

  await act(async () => jest.advanceTimersByTime(1000));

  expect(screen.getByRole('status')).toHaveTextContent('Comentário publicado com sucesso.');
  expect(screen.getByText(comment.content)).toBeInTheDocument();
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Enviar' })).toBeEnabled();
  expect(global.fetch.mock.calls[4]).toEqual(['http://localhost:4002/posts']);
  expect(global.fetch.mock.calls.some(([url]) => url.includes(':4000'))).toBe(false);

  await act(async () => jest.advanceTimersByTime(3000));
  expect(global.fetch).toHaveBeenCalledTimes(5);
  expect(jest.getTimerCount()).toBe(0);
});

test.each([
  ['Isso é spam', 'A palavra "spam" não é permitida.'],
  ['Você é um idiota', 'A palavra "idiota" não é permitida.'],
  ['Contato @proibido', 'O caractere "@" não é permitido.']
])('rejeita %s com motivo separado e sem alterar a lista', async (content, reason) => {
  jest.useFakeTimers('legacy');
  const existing = { id: 'existing', content: 'Muito bom!', status: 'approved' };
  global.fetch
    .mockResolvedValueOnce(jsonResponse({ post1: { ...post, comments: [existing] } }))
    .mockResolvedValueOnce(jsonResponse({ ...comment, content }))
    .mockResolvedValueOnce(jsonResponse(comment))
    .mockResolvedValueOnce(jsonResponse({ id: comment.id, status: 'rejected', reason }));
  render(<App />);
  await flushUpdates();
  await submitComment(content);

  expect(screen.getByRole('status')).toHaveTextContent('Seu comentário está sendo verificado...');
  await act(async () => jest.advanceTimersByTime(1000));

  const alert = screen.getByRole('alert');
  expect(alert).toHaveTextContent('Seu comentário não pôde ser publicado.');
  expect(alert).toHaveTextContent(`Motivo: ${reason}`);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.queryByText(content)).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Comentário' })).toHaveValue('');
  expect(screen.getAllByRole('listitem')).toHaveLength(1);
  expect(within(screen.getByRole('list')).queryByText(/Motivo|spam|idiota|@/)).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /Comentários/ })).toHaveTextContent('Comentários1');
  expect(screen.getByRole('button', { name: 'Enviar' })).toBeEnabled();

  await act(async () => jest.advanceTimersByTime(3000));
  expect(global.fetch).toHaveBeenCalledTimes(4);
  expect(jest.getTimerCount()).toBe(0);
});

test('encerra imediatamente quando o primeiro status já está aprovado', async () => {
  jest.useFakeTimers('legacy');
  const onCommentApproved = jest.fn().mockResolvedValue();
  global.fetch
    .mockResolvedValueOnce(jsonResponse(comment))
    .mockResolvedValueOnce(jsonResponse({ id: comment.id, status: 'approved', reason: null }));
  render(<CommentCreate postId={post.id} onCommentApproved={onCommentApproved} />);
  await submitComment();

  expect(screen.getByRole('status')).toHaveTextContent('Comentário publicado com sucesso.');
  expect(onCommentApproved).toHaveBeenCalledTimes(1);
  await act(async () => jest.advanceTimersByTime(3000));
  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(jest.getTimerCount()).toBe(0);
});

test('limpa o timer ao desmontar um formulário com comentário pendente', async () => {
  jest.useFakeTimers('legacy');
  global.fetch.mockResolvedValue(jsonResponse(comment));
  const { unmount } = render(<CommentCreate postId={post.id} onCommentApproved={jest.fn()} />);
  await submitComment();
  const signal = global.fetch.mock.calls[1][1].signal;

  expect(jest.getTimerCount()).toBe(1);
  unmount();
  expect(signal.aborted).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
  await act(async () => jest.advanceTimersByTime(3000));
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

test('ignora uma resposta de status que chega depois de desmontar o formulário', async () => {
  let resolveStatus;
  const onCommentApproved = jest.fn();
  global.fetch
    .mockResolvedValueOnce(jsonResponse(comment))
    .mockReturnValueOnce(new Promise(resolve => { resolveStatus = resolve; }));
  const { unmount } = render(<CommentCreate postId={post.id} onCommentApproved={onCommentApproved} />);
  await submitComment();
  const signal = global.fetch.mock.calls[1][1].signal;

  unmount();
  await act(async () => resolveStatus(jsonResponse({ ...comment, status: 'approved' })));
  expect(signal.aborted).toBe(true);
  expect(onCommentApproved).not.toHaveBeenCalled();
});

test.each([
  ['comentário não encontrado', () => Promise.resolve({ ok: false, status: 404 })],
  ['Comments offline', () => Promise.reject(new Error('Failed to fetch'))]
])('interrompe consultas e informa o erro se ocorrer %s', async (_, statusResponse) => {
  jest.useFakeTimers('legacy');
  const onCommentApproved = jest.fn();
  global.fetch.mockResolvedValueOnce(jsonResponse(comment)).mockImplementationOnce(statusResponse);
  render(<CommentCreate postId={post.id} onCommentApproved={onCommentApproved} />);
  await submitComment();

  expect(screen.getByRole('alert')).toHaveTextContent('O comentário foi enviado, mas não foi possível consultar a moderação.');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Enviar' })).toBeEnabled();
  await act(async () => jest.advanceTimersByTime(3000));
  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(onCommentApproved).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

test('não consulta indefinidamente o Query por comentários pendentes de outros envios', async () => {
  jest.useFakeTimers('legacy');
  global.fetch.mockResolvedValue(jsonResponse({ post1: { ...post, comments: [comment] } }));
  render(<App />);
  await flushUpdates();

  expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  await act(async () => jest.advanceTimersByTime(3000));
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});
