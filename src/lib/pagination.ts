export type PaginationItem = number | "ellipsis-start" | "ellipsis-end";

export function getCurrentPage(value: string | string[] | undefined, totalPages: number) {
  const rawPage = Array.isArray(value) ? value[0] : value;
  const requestedPage = Number(rawPage ?? "1");
  const pageCount = Math.max(1, Math.floor(totalPages));

  if (!Number.isSafeInteger(requestedPage) || requestedPage < 1) return 1;
  return Math.min(requestedPage, pageCount);
}

export function getPaginationItems(currentPage: number, totalPages: number): PaginationItem[] {
  const pageCount = Math.max(1, Math.floor(totalPages));
  const page = Math.min(Math.max(1, Math.floor(currentPage)), pageCount);
  const visiblePages = new Set<number>([1, pageCount]);

  for (let candidate = Math.max(1, page - 1); candidate <= Math.min(pageCount, page + 1); candidate += 1) {
    visiblePages.add(candidate);
  }

  const sortedPages = [...visiblePages].sort((a, b) => a - b);
  const items: PaginationItem[] = [];
  let previousPage = 0;

  for (const visiblePage of sortedPages) {
    const gap = visiblePage - previousPage;
    if (gap === 2) {
      items.push(previousPage + 1);
    } else if (gap > 2) {
      items.push(previousPage === 1 ? "ellipsis-start" : "ellipsis-end");
    }

    items.push(visiblePage);
    previousPage = visiblePage;
  }

  return items;
}
