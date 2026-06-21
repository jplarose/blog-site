using System.Data;
using BlogSite.Api.Options;
using Microsoft.Extensions.Options;
using Npgsql;

namespace BlogSite.Api.Extensions;

/// <summary>
/// Registers PostgreSQL access for repository usage.
/// </summary>
public static class AddPostgresExtension
{
    /// <summary>
    /// Adds a configured <see cref="NpgsqlDataSource" /> and scoped
    /// <see cref="IDbConnection" /> to dependency injection.
    /// </summary>
    public static IServiceCollection AddPostgres(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<DataSourceOptions>(configuration.GetSection("DataSource"));

        services.AddSingleton(serviceProvider =>
        {
            var options = serviceProvider
                .GetRequiredService<IOptions<DataSourceOptions>>()
                .Value;

            if (string.IsNullOrWhiteSpace(options.Host) ||
                string.IsNullOrWhiteSpace(options.Database) ||
                string.IsNullOrWhiteSpace(options.User) ||
                string.IsNullOrWhiteSpace(options.Password))
            {
                throw new InvalidOperationException(
                    "DataSource configuration is incomplete.");
            }

            var connectionString = new NpgsqlConnectionStringBuilder
            {
                Host = options.Host,
                Database = options.Database,
                Username = options.User,
                Password = options.Password
            };

            return NpgsqlDataSource.Create(connectionString.ConnectionString);
        });

        services.AddScoped<IDbConnection>(serviceProvider =>
            serviceProvider
                .GetRequiredService<NpgsqlDataSource>()
                .CreateConnection());

        return services;
    }
}
