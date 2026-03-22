namespace BlogSite.Api.Results;

public sealed record ResultError(string Code, string Message);

public class Result
{
    protected Result(bool isSuccess, ResultError? error)
    {
        IsSuccess = isSuccess;
        Error = error;
    }

    public bool IsSuccess { get; }
    public bool IsFailure => !IsSuccess;
    public ResultError? Error { get; }

    public static Result Success() => new(true, null);

    public static Result Failure(string code, string message) =>
        new(false, new ResultError(code, message));
}

public sealed class Result<T> : Result
{
    private Result(bool isSuccess, T? value, ResultError? error)
        : base(isSuccess, error)
    {
        Value = value;
    }

    public T? Value { get; }

    public static Result<T> Success(T value) => new(true, value, null);

    public static new Result<T> Failure(string code, string message) =>
        new(false, default, new ResultError(code, message));
}
