export function slugify(
  text: string,
  options?: { lower?: boolean; strict?: boolean }
): string {
  let slug = text.toString();

  // Convert to lowercase if specified
  if (options?.lower) {
    slug = slug.toLowerCase();
  }

  // Replace spaces with hyphens
  slug = slug.replace(/\s+/g, "-");

  if (options?.strict) {
    // Remove all non-word chars (keep only letters, numbers and hyphens)
    slug = slug.replace(/[^\w-]+/g, "");
  } else {
    // Remove special characters but keep spaces and hyphens
    slug = slug.replace(/[^a-zA-Z0-9\s-]/g, "");
  }

  // Remove multiple hyphens
  slug = slug.replace(/-+/g, "-");

  // Remove leading and trailing hyphens
  slug = slug.replace(/^-+|-+$/g, "");

  return slug;
}
