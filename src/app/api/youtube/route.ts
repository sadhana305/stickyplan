import { withUser } from "@/lib/api-helpers";

const CATEGORY_QUERIES: Record<string, string> = {
  beginner: "explained for beginners",
  detailed: "full course lecture",
  revision: "revision and summary",
  problems: "problems and solutions step by step",
};

/** Real YouTube search via the official Data API v3.
 *  Requires YOUTUBE_API_KEY to be configured in the environment.
 *  When the key is missing we return an honest setup message — never fake results. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const category = url.searchParams.get("category") ?? "detailed";

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    return Response.json(
      {
        configured: false,
        message:
          "YouTube search needs a YouTube Data API v3 key. Add it as the YOUTUBE_API_KEY environment variable (create a free key in the Google Cloud Console → YouTube Data API v3). Until then, this feature stays honestly offline instead of showing made-up videos.",
      },
      { status: 200 }
    );
  }

  if (!q) return Response.json({ error: "Type a topic to search for." }, { status: 400 });

  const searchQuery = `${q} ${CATEGORY_QUERIES[category] ?? ""} educational`
    .trim()
    .slice(0, 120);

  try {
    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("q", searchQuery);
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("maxResults", "8");
    searchUrl.searchParams.set("relevanceLanguage", "en");
    searchUrl.searchParams.set("key", key);

    const searchRes = await fetch(searchUrl.toString(), { cache: "no-store" });
    if (!searchRes.ok) {
      const err = (await searchRes.json().catch(() => null)) as { error?: { message?: string } } | null;
      return Response.json(
        { configured: true, error: err?.error?.message ?? "YouTube API request failed." },
        { status: 502 }
      );
    }
    const data = (await searchRes.json()) as {
      items?: { id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string; thumbnails?: { medium?: { url?: string } } } }[];
    };

    const videos = (data.items ?? [])
      .filter((i) => i.id?.videoId && i.snippet)
      .map((i) => ({
        videoId: i.id!.videoId!,
        title: i.snippet!.title ?? "Untitled",
        channel: i.snippet!.channelTitle ?? "Unknown channel",
        thumbnail: i.snippet!.thumbnails?.medium?.url ?? null,
        url: `https://www.youtube.com/watch?v=${i.id!.videoId}`,
        duration: null as string | null,
      }));

    // Fetch durations in one extra call
    if (videos.length > 0) {
      const ids = videos.map((v) => v.videoId).join(",");
      const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
      detailsUrl.searchParams.set("part", "contentDetails");
      detailsUrl.searchParams.set("id", ids);
      detailsUrl.searchParams.set("key", key);
      const detailsRes = await fetch(detailsUrl.toString(), { cache: "no-store" });
      if (detailsRes.ok) {
        const details = (await detailsRes.json()) as {
          items?: { id?: string; contentDetails?: { duration?: string } }[];
        };
        for (const d of details.items ?? []) {
          const v = videos.find((x) => x.videoId === d.id);
          if (v && d.contentDetails?.duration) {
            const m = d.contentDetails.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
            if (m) {
              const h = parseInt(m[1] ?? "0", 10);
              const min = parseInt(m[2] ?? "0", 10);
              const s = parseInt(m[3] ?? "0", 10);
              v.duration = h > 0 ? `${h}h ${min}m` : min > 0 ? `${min}m ${s}s` : `${s}s`;
            }
          }
        }
      }
    }

    return Response.json({ configured: true, videos });
  } catch {
    return Response.json(
      { configured: true, error: "Could not reach the YouTube API. Check your network or API key quota." },
      { status: 502 }
    );
  }
}
