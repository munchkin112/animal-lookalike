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
  return json({ comments: await readComments(env) });
}

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const nickname = trimText(body.nickname, 16);
  const text = trimText(body.text, 180);

  if (!nickname || !text) {
    return json({ message: '닉네임과 댓글을 입력해주세요.' }, 400);
  }

  const comments = await readComments(env);
  const nextComments = [
    {
      id: crypto.randomUUID(),
      nickname,
      text,
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
  return json({ comments: nextComments }, 201);
}
