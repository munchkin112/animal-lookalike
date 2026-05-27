const COMMENTS_KEY = 'comments';
const MAX_COMMENTS = 100;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

function trimText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function publicComment(comment) {
  const { ownerToken, ...safeComment } = comment;
  return safeComment;
}

async function readComments(env) {
  if (!env.COMMENTS_KV) {
    return [];
  }

  const saved = await env.COMMENTS_KV.get(COMMENTS_KEY, 'json');
  return Array.isArray(saved) ? saved : [];
}

async function writeComments(env, comments) {
  if (!env.COMMENTS_KV) {
    throw new Error('COMMENTS_KV binding is missing.');
  }

  await env.COMMENTS_KV.put(COMMENTS_KEY, JSON.stringify(comments));
}

export async function onRequestGet({ env }) {
  const comments = await readComments(env);
  return json({ comments: comments.map(publicComment) });
}

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const nickname = trimText(body.nickname, 16);
  const text = trimText(body.text, 180);
  const ownerToken = trimText(body.ownerToken, 80);

  if (!nickname || !text || !ownerToken) {
    return json({ message: '닉네임과 댓글을 입력해주세요.' }, 400);
  }

  const comments = await readComments(env);
  const nextComments = [
    {
      id: crypto.randomUUID(),
      nickname,
      text,
      ownerToken,
      date: new Date().toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    },
    ...comments
  ].slice(0, MAX_COMMENTS);

  await writeComments(env, nextComments);
  return json({ comments: nextComments.map(publicComment) }, 201);
}

export async function onRequestDelete({ request, env }) {
  const url = new URL(request.url);
  const commentId = trimText(url.searchParams.get('id'), 80);
  const ownerToken = request.headers.get('x-comment-owner-token') || '';

  if (!commentId || !ownerToken) {
    return json({ message: '삭제 권한을 확인할 수 없습니다.' }, 400);
  }

  const comments = await readComments(env);
  const target = comments.find((comment) => comment.id === commentId);

  if (!target) {
    return json({ message: '댓글을 찾을 수 없습니다.' }, 404);
  }

  if (!target.ownerToken || target.ownerToken !== ownerToken) {
    return json({ message: '내가 작성한 댓글만 삭제할 수 있습니다.' }, 403);
  }

  const nextComments = comments.filter((comment) => comment.id !== commentId);
  await writeComments(env, nextComments);
  return json({ comments: nextComments.map(publicComment) });
}
