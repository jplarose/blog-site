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

        // PostTag composite key
        modelBuilder.Entity<PostTag>()
            .HasKey(pt => new { pt.PostId, pt.TagId });

        modelBuilder.Entity<PostTag>()
            .HasOne(pt => pt.Post)
            .WithMany(p => p.PostTags)
            .HasForeignKey(pt => pt.PostId);

        modelBuilder.Entity<PostTag>()
            .HasOne(pt => pt.Tag)
            .WithMany(t => t.PostTags)
            .HasForeignKey(pt => pt.TagId);

        // Post indexes
        modelBuilder.Entity<Post>()
            .HasIndex(p => p.Slug)
            .IsUnique();

        modelBuilder.Entity<Post>()
            .HasIndex(p => p.Status);

        modelBuilder.Entity<Post>()
            .HasIndex(p => p.PublishedAt);

        // Post → Category
        modelBuilder.Entity<Post>()
            .HasOne(p => p.Category)
            .WithMany(c => c.Posts)
            .HasForeignKey(p => p.CategoryId)
            .OnDelete(DeleteBehavior.SetNull);

        // Post → LayoutTemplate
        modelBuilder.Entity<Post>()
            .HasOne(p => p.Template)
            .WithMany(t => t.Posts)
            .HasForeignKey(p => p.TemplateId)
            .OnDelete(DeleteBehavior.SetNull);

        // Category → DefaultTemplate
        modelBuilder.Entity<Category>()
            .HasOne(c => c.DefaultTemplate)
            .WithMany(t => t.Categories)
            .HasForeignKey(c => c.DefaultTemplateId)
            .OnDelete(DeleteBehavior.SetNull);

        // Category unique slug
        modelBuilder.Entity<Category>()
            .HasIndex(c => c.Slug)
            .IsUnique();

        // Tag unique slug
        modelBuilder.Entity<Tag>()
            .HasIndex(t => t.Slug)
            .IsUnique();

        // PageView indexes
        modelBuilder.Entity<PageView>()
            .HasIndex(pv => pv.ViewedAt);

        modelBuilder.Entity<PageView>()
            .HasIndex(pv => pv.PostId);

        // Store PostStatus as string
        modelBuilder.Entity<Post>()
            .Property(p => p.Status)
            .HasConversion<string>();
    }
}
