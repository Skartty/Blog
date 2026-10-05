import './PostList.css';
import CommentList from '../CommentList/CommentList';
import CommentCreate from '../CommentCreate/CommentCreate';

const PostList = ({ posts, onCommentApproved }) => {
    const renderedPosts = Object.values(posts).map(post => (
        <article className="post-container" key={post.id}>
            <div className="card-body">
                <h3>{post.title}</h3>
                <CommentList comments={post.comments || []} />
                <CommentCreate postId={post.id} onCommentApproved={onCommentApproved} />
            </div>
        </article>
    ));

    return (
        <section className="post-list">
            {renderedPosts.length > 0 ? renderedPosts : (
                <div className="empty-posts">Nenhuma publicação encontrada.</div>
            )}
        </section>
    );
};

export default PostList;
