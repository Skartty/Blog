import { useCallback, useEffect, useState } from 'react';
import './App.css';
import PostCreate from './PostCreate/PostCreate';
import PostList from './PostList/PostList';

function App() {
  const [posts, setPosts] = useState({});
  const [error, setError] = useState('');

  const fetchPosts = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:4002/posts');

      if (!response.ok) {
        throw new Error(`Query respondeu com status ${response.status}`);
      }

      setPosts(await response.json());
      setError('');
    } catch (error) {
      console.error('Erro ao buscar posts:', error);
      setError('Não foi possível consultar as publicações. Função indisponível.');
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  return (
    <div className="App">
      <main className="app-shell">
        <header className="app-header">
          <span className="app-kicker">React Blog</span>
          <h1>Seu espaço para publicar.</h1>
          <p>
            Crie posts, acompanhe as publicações e
            compartilhe ideias através de uma interface
            simples e elegante.
          </p>
        </header>

        <PostCreate onPostCreated={fetchPosts} />
        {error && <p role="alert">{error}</p>}
        <PostList posts={posts} onCommentApproved={fetchPosts} />
      </main>
    </div>
  );
}

export default App;
