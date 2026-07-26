import { applyFieldSelection } from '../../src/utils/field-selection.util';

describe('applyFieldSelection', () => {
  const item = { id: '1', title: 'Title', content: 'Content', archived: false };

  it('returns the item unchanged when neither include nor exclude is given', () => {
    expect(applyFieldSelection(item)).toBe(item);
  });

  it('restricts to the included fields plus id', () => {
    expect(applyFieldSelection(item, ['title'])).toEqual({ id: '1', title: 'Title' });
  });

  it('drops the excluded fields, keeping id', () => {
    expect(applyFieldSelection(item, undefined, ['content', 'archived'])).toEqual({ id: '1', title: 'Title' });
  });

  it('include takes precedence over exclude when both are given', () => {
    expect(applyFieldSelection(item, ['title'], ['title'])).toEqual({ id: '1', title: 'Title' });
  });

  it('never drops id even if the caller asks to exclude it', () => {
    expect(applyFieldSelection(item, undefined, ['id', 'content', 'archived'])).toEqual({ id: '1', title: 'Title' });
  });

  it('ignores an included field name that does not exist on the item', () => {
    expect(applyFieldSelection(item, ['title', 'notAField'])).toEqual({ id: '1', title: 'Title' });
  });
});
