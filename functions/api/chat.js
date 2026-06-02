export async function onRequestPost(context) {
  try {
    const body = await context.request.json();

    const messages = Array.isArray(body.messages) && body.messages.length
      ? body.messages
      : [
          { role: "system", content: "You are a helpful English tutor." },
          { role: "user", content: body.message || "" },
        ];

    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + (context.env.DEEPSEEK_API_KEY || ""),
      },
      body: JSON.stringify({
        model: body.model || "deepseek-chat",
        messages,
      }),
    });

    const data = await res.json();

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.toString() }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
