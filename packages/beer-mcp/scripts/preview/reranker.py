# This script demonstrates how to use the native Azure Cosmos DB SDK semantic
# reranker to rerank search results based on a user query.
# The semantic reranker is currently under private preview, if you're interested
# in trying it out, sign up here: aka.ms/AzureCosmosDB/RerankerPreview
#
# Install dependencies:
# pip install azure-cosmos azure-identity openai python-dotenv
import os
import json
from dotenv import load_dotenv
from azure.cosmos import CosmosClient
from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from openai import OpenAI

load_dotenv(os.path.join(os.path.dirname(__file__), "../../../../.env"))

cosmosdb_endpoint = os.environ["AZURE_COSMOSDB_NOSQL_ENDPOINT"]
openai_endpoint = os.environ["AZURE_OPENAI_API_ENDPOINT"]
embeddings_model = os.environ.get("AZURE_OPENAI_EMBEDDINGS_MODEL", "text-embedding-3-small")

# Set reranking endpoint for Cosmos DB SDK semantic reranker
account_name = cosmosdb_endpoint.split("//")[1].split(".")[0]
os.environ["AZURE_COSMOS_SEMANTIC_RERANKER_INFERENCE_ENDPOINT"] = (
    f"https://{account_name}.westus3.dbinference.azure.com"
)

# query = "5% beer from france"
query = "Booze-free for spicy food, for my pregnant wife"
# query = "light, citrusy beer"
# query = "bière légère et citronnée"


def main():
    credential = DefaultAzureCredential()
    token_provider = get_bearer_token_provider(credential, "https://cognitiveservices.azure.com/.default")
    openai_client = OpenAI(base_url=openai_endpoint, api_key=token_provider())

    query_vector = openai_client.embeddings.create(input=query, model=embeddings_model).data[0].embedding

    # Cosmos DB client
    client = CosmosClient(cosmosdb_endpoint, credential=credential)
    container = client.get_database_client("beerDB").get_container_client("beerVectors")

    terms = [t for t in query.replace(",", "").split() if len(t) > 3]
    term_params = [{"name": f"@term{i}", "value": t} for i, t in enumerate(terms)]
    term_names = ", ".join(p["name"] for p in term_params)

    hybrid_sql = f"""
        SELECT TOP 10 c.id, c.text
        FROM c
        ORDER BY RANK RRF(
            FullTextScore(c.text, {term_names}),
            VectorDistance(c.vector, @embedding)
        )
    """
    keyword_sql = f"""
        SELECT TOP 1000 c.id
        FROM c
        ORDER BY RANK FullTextScore(c.text, {term_names})
    """
    vector_sql = """
        SELECT TOP 1000 c.id
        FROM c
        ORDER BY VectorDistance(c.vector, @embedding)
    """

    print(f'Search: "{query}"\n')

    keyword_results = list(container.query_items(
        query=keyword_sql,
        parameters=term_params,
        enable_cross_partition_query=True,
    ))
    vector_results = list(container.query_items(
        query=vector_sql,
        parameters=[{"name": "@embedding", "value": query_vector}],
        enable_cross_partition_query=True,
    ))
    hybrid_results = list(container.query_items(
        query=hybrid_sql,
        parameters=[{"name": "@embedding", "value": query_vector}, *term_params],
        enable_cross_partition_query=True,
    ))

    keyword_rank = {item["id"]: i + 1 for i, item in enumerate(keyword_results)}
    vector_rank = {item["id"]: i + 1 for i, item in enumerate(vector_results)}

    candidates = []
    for i, item in enumerate(hybrid_results):
        text = item["text"]
        parts = text.split(" - ", 1)
        title = parts[0]
        description = parts[1] if len(parts) > 1 else ""
        candidates.append({
            "id": item["id"],
            "title": title,
            "description": description,
            "text": text,
            "rrfRank": i + 1,
            "kr": keyword_rank.get(item["id"]),
            "vr": vector_rank.get(item["id"]),
        })

    # Cosmos DB SDK semantic reranker
    reranked_results = container.semantic_rerank(
        context=query,
        documents=[json.dumps({"text": c["text"]}) for c in candidates],
        options={
            "return_documents": True,
            "top_k": 5,
            "sort": True,
            "document_type": "json",
            "target_paths": "text",
        },
    )

    for rank, score in enumerate(reranked_results["Scores"], 1):
        idx = score["index"]
        c = candidates[idx]
        kr_str = f"#{c['kr']} keyword" if c["kr"] else "#- keyword"
        vr_str = f"#{c['vr']} vector" if c["vr"] else "#- vector"
        print(f"#{rank} {c['title']} (score: {score['score']:.4f}) - {kr_str}, {vr_str}, #{c['rrfRank']} RRF")
        print(f"   {c['description']}\n")

    print(f"Latency: preprocess={reranked_results['latency']['data_preprocess_time']}, "
          f"inference={reranked_results['latency']['inference_time']}, "
          f"postprocess={reranked_results['latency']['postprocess_time']}")
    print(f"Token usage: {reranked_results['token_usage']}")


if __name__ == "__main__":
    main()
