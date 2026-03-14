namespace BlogSite.Api.DTOs;

public record AnalyticsSummaryDto(
    int TotalPageViews,
    int UniqueVisitors,
    int TotalPosts,
    int PublishedPosts,
    int DraftPosts,
    IEnumerable<TopPostDto> TopPosts,
    IEnumerable<DailyViewDto> DailyViews
);

public record TopPostDto(
    int PostId,
    string Title,
    string Slug,
    int ViewCount
);

public record DailyViewDto(
    DateOnly Date,
    int ViewCount
);
