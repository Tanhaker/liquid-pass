"use client";

import { ApolloClient, InMemoryCache, HttpLink } from "@apollo/client";
import { SUBGRAPH_URL } from "./graph";

export const apolloClient = new ApolloClient({
  link: new HttpLink({
    uri: SUBGRAPH_URL || "https://api.studio.thegraph.com/query/99999/liquid-pass/version/latest",
  }),
  cache: new InMemoryCache(),
});
