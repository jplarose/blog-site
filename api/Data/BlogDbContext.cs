using BlogSite.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace BlogSite.Api.Data;

public class BlogDbContext(DbContextOptions<BlogDbContext> options) : DbContext(options)
{
    public DbSet<Post> Posts => Set<Post>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Tag> Tags => Set<Tag>();
    public DbSet<PostTag> PostTags => Set<PostTag>();
    public DbSet<LayoutTemplate> LayoutTemplates => Set<LayoutTemplate>();
    public DbSet<PageView> PageViews => Set<PageView>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<LayoutTemplate>(entity =>
        {
            entity.ToTable("layout_templates");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Name).HasColumnName("name");
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.LayoutJson).HasColumnName("layout_json").HasColumnType("jsonb");
            entity.Property(e => e.IsDefault).HasColumnName("is_default");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
        });

        modelBuilder.Entity<Category>(entity =>
        {
            entity.ToTable("categories");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Name).HasColumnName("name");
            entity.Property(e => e.Slug).HasColumnName("slug");
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.DefaultTemplateId).HasColumnName("default_template_id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");

            entity.HasIndex(e => e.Slug).IsUnique();

            entity.HasOne(e => e.DefaultTemplate)
                .WithMany(t => t.Categories)
                .HasForeignKey(e => e.DefaultTemplateId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Post>(entity =>
        {
            entity.ToTable("posts");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Title).HasColumnName("title");
            entity.Property(e => e.Slug).HasColumnName("slug");
            entity.Property(e => e.Content).HasColumnName("content");
            entity.Property(e => e.Excerpt).HasColumnName("excerpt");
            entity.Property(e => e.FeaturedImageUrl).HasColumnName("featured_image_url");
            entity.Property(e => e.Status).HasColumnName("status").HasConversion<string>();
            entity.Property(e => e.PublishedAt).HasColumnName("published_at");
            entity.Property(e => e.ScheduledAt).HasColumnName("scheduled_at");
            entity.Property(e => e.CategoryId).HasColumnName("category_id");
            entity.Property(e => e.TemplateId).HasColumnName("template_id");
            entity.Property(e => e.TemplateContentJson).HasColumnName("template_content").HasColumnType("jsonb");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");

            entity.HasIndex(e => e.Slug).IsUnique();
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.PublishedAt);

            entity.HasOne(e => e.Category)
                .WithMany(c => c.Posts)
                .HasForeignKey(e => e.CategoryId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(e => e.Template)
                .WithMany(t => t.Posts)
                .HasForeignKey(e => e.TemplateId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Tag>(entity =>
        {
            entity.ToTable("tags");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Name).HasColumnName("name");
            entity.Property(e => e.Slug).HasColumnName("slug");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");

            entity.HasIndex(e => e.Slug).IsUnique();
        });

        modelBuilder.Entity<PostTag>(entity =>
        {
            entity.ToTable("post_tags");

            entity.Property(e => e.PostId).HasColumnName("post_id");
            entity.Property(e => e.TagId).HasColumnName("tag_id");

            entity.HasKey(e => new { e.PostId, e.TagId });

            entity.HasOne(e => e.Post)
                .WithMany(p => p.PostTags)
                .HasForeignKey(e => e.PostId);

            entity.HasOne(e => e.Tag)
                .WithMany(t => t.PostTags)
                .HasForeignKey(e => e.TagId);
        });

        modelBuilder.Entity<PageView>(entity =>
        {
            entity.ToTable("page_views");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.PostId).HasColumnName("post_id");
            entity.Property(e => e.Path).HasColumnName("path");
            entity.Property(e => e.IpAddress).HasColumnName("ip_address");
            entity.Property(e => e.UserAgent).HasColumnName("user_agent");
            entity.Property(e => e.Referrer).HasColumnName("referrer");
            entity.Property(e => e.ViewedAt).HasColumnName("viewed_at");

            entity.HasIndex(e => e.ViewedAt);
            entity.HasIndex(e => e.PostId);
        });
    }
}
