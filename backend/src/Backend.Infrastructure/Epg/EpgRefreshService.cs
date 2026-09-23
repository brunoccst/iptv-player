using System.Data.Common;
using System.Xml;
using Backend.Core.Epg;
using Backend.Core.Providers;
using Backend.Infrastructure.Accounts;
using Backend.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Backend.Infrastructure.Epg;

/// <summary>Downloads an account's XMLTV guide and replaces its cached programmes. See DECISIONS.md#d-031.</summary>
public sealed class EpgRefreshService(AccountService accounts, AppDbContext db, TimeProvider clock)
{
    /// <summary>Programmes kept around "now". Older and later entries are dropped at download time.</summary>
    public static readonly TimeSpan PastWindow = TimeSpan.FromHours(3);
    public static readonly TimeSpan FutureWindow = TimeSpan.FromHours(48);

    /// <summary>Returns the number of programmes stored. Provider or XML errors keep the previous guide and are recorded.</summary>
    public async Task<int> RefreshAsync(Guid accountId, CancellationToken ct)
    {
        var key = accountId.ToString();
        var now = clock.GetUtcNow();
        var state = await db.EpgStates.SingleOrDefaultAsync(s => s.AccountId == key, ct);
        if (state is null)
        {
            state = new EpgState { AccountId = key };
            db.EpgStates.Add(state);
        }
        state.LastAttemptAt = now;
        await db.SaveChangesAsync(ct);

        try
        {
            var context = await accounts.GetProviderContextAsync(accountId, ct);
            await using var xml = await context.Provider.OpenXmltvAsync(context.Credentials, ct);
            var count = await ReplaceAsync(key, XmltvParser.ParseAsync(xml, now - PastWindow, now + FutureWindow, ct), ct);
            state.UpdatedAt = now;
            state.ProgrammeCount = count;
            state.LastError = null;
            return count;
        }
        catch (Exception exception) when (exception is ProviderException or XmlException)
        {
            state.LastError = exception.Message.Length > 500 ? exception.Message[..500] : exception.Message;
            throw;
        }
        finally
        {
            await db.SaveChangesAsync(CancellationToken.None);
        }
    }

    /// <summary>
    /// Deletes and re-inserts in one transaction with a prepared command: EF change tracking is too slow for
    /// hundreds of thousands of rows. A parse error mid-file rolls back to the previous guide.
    /// </summary>
    private async Task<int> ReplaceAsync(string accountId, IAsyncEnumerable<EpgProgramme> programmes, CancellationToken ct)
    {
        var connection = db.Database.GetDbConnection();
        await db.Database.OpenConnectionAsync(ct);
        try
        {
            await using var transaction = await connection.BeginTransactionAsync(ct);

            await using (var delete = connection.CreateCommand())
            {
                delete.Transaction = transaction;
                delete.CommandText = "DELETE FROM EpgProgrammes WHERE AccountId = $account";
                AddParameter(delete, "$account", accountId);
                await delete.ExecuteNonQueryAsync(ct);
            }

            await using var insert = connection.CreateCommand();
            insert.Transaction = transaction;
            insert.CommandText = """
                INSERT INTO EpgProgrammes (AccountId, ChannelKey, Start, "End", Title, Description)
                VALUES ($account, $channel, $start, $end, $title, $description)
                """;
            AddParameter(insert, "$account", accountId);
            var channel = AddParameter(insert, "$channel", string.Empty);
            var start = AddParameter(insert, "$start", 0L);
            var end = AddParameter(insert, "$end", 0L);
            var title = AddParameter(insert, "$title", string.Empty);
            var description = AddParameter(insert, "$description", DBNull.Value);
            await insert.PrepareAsync(ct);

            var count = 0;
            await foreach (var programme in programmes.WithCancellation(ct))
            {
                channel.Value = Truncate(programme.ChannelKey, 200);
                start.Value = programme.Start.UtcTicks;
                end.Value = programme.End.UtcTicks;
                title.Value = Truncate(programme.Title, 300);
                description.Value = programme.Description is null ? DBNull.Value : Truncate(programme.Description, 2000);
                await insert.ExecuteNonQueryAsync(ct);
                count++;
            }

            await transaction.CommitAsync(ct);
            return count;
        }
        finally
        {
            await db.Database.CloseConnectionAsync();
        }
    }

    private static DbParameter AddParameter(DbCommand command, string name, object value)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.Value = value;
        command.Parameters.Add(parameter);
        return parameter;
    }

    private static string Truncate(string value, int length) => value.Length > length ? value[..length] : value;
}
