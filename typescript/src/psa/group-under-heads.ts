import { Array as A, Option } from 'effect';

/**
 * Groups each item with the nearest item before it that `isHead` accepts, as a
 * PSA file places a row after the one it belongs to. The items before every
 * head belong to none, so they are returned apart, as `leading`.
 */
export const groupUnderHeads = <Item, Head extends Item, Group>({
  isHead,
  items,
  toGroup,
}: Readonly<{
  isHead: (item: NoInfer<Item>) => item is Head;
  items: ReadonlyArray<Item>;
  toGroup: (head: Head, followers: ReadonlyArray<Exclude<Item, Head>>) => Group;
}>): Readonly<{
  groups: ReadonlyArray<Group>;
  leading: ReadonlyArray<Exclude<Item, Head>>;
}> => {
  const isFollower = (item: Item): item is Exclude<Item, Head> => !isHead(item);
  const heads = A.getSomes(
    A.map(items, (item, index) =>
      isHead(item) ? Option.some({ head: item, index }) : Option.none(),
    ),
  );
  return {
    groups: heads.map(({ head, index }, position) =>
      toGroup(
        head,
        A.filter(
          items.slice(index + 1, heads[position + 1]?.index),
          isFollower,
        ),
      ),
    ),
    leading: A.filter(items.slice(0, heads[0]?.index), isFollower),
  };
};
