using System.Data;
using System.Data.Common;

namespace BlogSite.Api.Repositories;

internal static class RepositoryConnection
{
    public static async Task EnsureOpenAsync(
        IDbConnection connection,
        CancellationToken cancellationToken)
    {
        if (connection.State == ConnectionState.Open)
        {
            return;
        }

        if (connection is not DbConnection dbConnection)
        {
            throw new InvalidOperationException(
                "The configured database connection must derive from DbConnection.");
        }

        await dbConnection.OpenAsync(cancellationToken);
    }
}
