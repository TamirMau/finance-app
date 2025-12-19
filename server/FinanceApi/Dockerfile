# שלב build
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY FinanceApi/*.csproj ./FinanceApi/
RUN dotnet restore FinanceApi/FinanceApi.csproj
COPY FinanceApi/. ./FinanceApi/
WORKDIR /src/FinanceApi
RUN dotnet publish -c Release -o /app/publish

# שלב runtime
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "FinanceApi.dll"]