using System.Data;
using BlogSite.Api.Extensions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace BlogSite.Api.Tests.Extensions;

public class AddPostgresExtensionTests
{
    [Fact]
    public void AddPostgres_CompleteConfiguration_RegistersConfiguredConnection()
    {
        var configuration = BuildConfiguration(new Dictionary<string, string?>
        {
            ["DataSource:Host"] = "database.example.test",
            ["DataSource:Database"] = "blog-site",
            ["DataSource:User"] = "blogsite_api",
            ["DataSource:Password"] = "secret"
        });
        var services = new ServiceCollection();

        services.AddPostgres(configuration);

        using var provider = services.BuildServiceProvider();
        using var scope = provider.CreateScope();
        var connection = scope.ServiceProvider.GetRequiredService<IDbConnection>();
        var connectionString = new NpgsqlConnectionStringBuilder(connection.ConnectionString);

        Assert.Equal("database.example.test", connectionString.Host);
        Assert.Equal("blog-site", connectionString.Database);
        Assert.Equal("blogsite_api", connectionString.Username);
        Assert.Equal(ConnectionState.Closed, connection.State);
    }

    [Fact]
    public void AddPostgres_IncompleteConfiguration_ThrowsConfigurationError()
    {
        var configuration = BuildConfiguration(new Dictionary<string, string?>
        {
            ["DataSource:Host"] = "database.example.test"
        });
        var services = new ServiceCollection();
        services.AddPostgres(configuration);
        using var provider = services.BuildServiceProvider();

        var exception = Assert.Throws<InvalidOperationException>(
            () => provider.GetRequiredService<NpgsqlDataSource>());

        Assert.Equal("DataSource configuration is incomplete.", exception.Message);
    }

    private static IConfiguration BuildConfiguration(
        Dictionary<string, string?> values) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(values)
            .Build();
}
