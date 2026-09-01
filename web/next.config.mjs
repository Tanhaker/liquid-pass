/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { webpack }) => {
    /**
     * RainbowKit imports the whole `@wagmi/connectors` barrel, which includes
     * the Base Account connector. That reaches @coinbase/cdp-sdk, which
     * imports several `@x402/evm/*` subpaths -- optional peers that are not
     * installed. Webpack treats each unresolved import as fatal, so the whole
     * app fails to compile even though nothing in Liquid Pass uses Base
     * Account.
     *
     * Ignored by pattern rather than aliased path-by-path: the first attempt
     * stubbed `@x402/evm/upto/client`, and the build then failed on
     * `@x402/evm/exact/client`. There was no reason to think those were the
     * only two.
     *
     * `webpack` comes from the second argument, not a top-level import --
     * webpack is not a direct dependency here, it is vendored inside Next, so
     * importing it by name fails at config load.
     *
     * Safe because the code path is unreachable: we never construct a Base
     * Account connector. The previous hand-rolled wagmi setup dodged this by
     * importing `injected` from the wagmi root rather than the barrel;
     * RainbowKit gives no such choice.
     */
    config.plugins.push(
      new webpack.IgnorePlugin({ resourceRegExp: /^@x402\// }),
    );
    return config;
  },
};

export default nextConfig;
