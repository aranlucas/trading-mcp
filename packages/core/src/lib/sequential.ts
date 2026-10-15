/** Visit items in order, stopping on failure without starting later work. */
export function forEachSequential<T>(
  items: readonly T[],
  visit: (item: T) => Promise<void>,
): Promise<void> {
  const iterator = items[Symbol.iterator]();

  async function next(): Promise<void> {
    const item = iterator.next();

    if (item.done) {
      return;
    }

    await visit(item.value);

    return next();
  }

  return next();
}
