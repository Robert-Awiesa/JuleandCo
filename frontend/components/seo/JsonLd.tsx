/**
 * Emits a schema.org block for search engines.
 *
 * A server component with no client cost — the JSON is rendered into the HTML
 * and never hydrated.
 *
 * `<` is escaped because a product description or a customer's name could
 * otherwise close the script tag early and inject markup into the page. JSON is
 * embedded in HTML here, so it has to be escaped for HTML, not only for JSON.
 */
export function JsonLd({ schema }: { schema: Record<string, unknown> }) {
  const json = JSON.stringify(schema).replace(/</g, "\\u003c");

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
  );
}
