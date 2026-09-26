import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardSensor, PointerSensor, TouchSensor, closestCorners, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';

/**
 * Drag & drop between containers (board columns or sprint groups).
 *
 * @param tasks         tasks to distribute
 * @param containerIds  ordered container ids
 * @param getContainer  task => container id
 * @param onMove        (taskId, fromContainer, toContainer, orderedIdsInTarget) => void
 */
export function useContainerDnd({ tasks, containerIds, getContainer, onMove, onDragStart, onDragEnd }) {
  const build = useCallback(() => {
    const map = Object.fromEntries(containerIds.map((id) => [id, []]));
    [...tasks]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .forEach((task) => {
        const container = getContainer(task);
        if (map[container]) map[container].push(task._id);
      });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, containerIds.join('|')]);

  const [columns, setColumns] = useState(build);
  const [activeId, setActiveId] = useState(null);
  const origin = useRef(null);

  // Re-sync from data whenever it changes, except in the middle of a drag
  useEffect(() => {
    if (!activeId) setColumns(build());
  }, [build, activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const findContainer = useCallback(
    (id, cols = columns) => (id in cols ? id : Object.keys(cols).find((key) => cols[key].includes(id))),
    [columns]
  );

  const handlers = useMemo(
    () => ({
      sensors,
      collisionDetection: closestCorners,
      onDragStart({ active }) {
        setActiveId(active.id);
        origin.current = findContainer(active.id);
        onDragStart?.();
      },
      onDragOver({ active, over }) {
        if (!over) return;
        setColumns((cols) => {
          const from = findContainer(active.id, cols);
          const to = findContainer(over.id, cols);
          if (!from || !to || from === to) return cols;
          const target = cols[to];
          const overIndex = target.indexOf(over.id);
          const index = overIndex >= 0 ? overIndex : target.length;
          return {
            ...cols,
            [from]: cols[from].filter((id) => id !== active.id),
            [to]: [...target.slice(0, index), active.id, ...target.slice(index)],
          };
        });
      },
      onDragEnd({ active, over }) {
        const from = origin.current;
        setActiveId(null);
        onDragEnd?.();
        if (!over) {
          setColumns(build());
          return;
        }
        const to = findContainer(over.id);
        if (!to) return;

        let ordered = columns[to];
        const oldIndex = ordered.indexOf(active.id);
        const newIndex = ordered.indexOf(over.id);
        if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) ordered = arrayMove(ordered, oldIndex, newIndex);
        if (from === to && oldIndex === newIndex) return;

        setColumns((cols) => ({ ...cols, [to]: ordered }));
        onMove(active.id, from, to, ordered);
      },
      onDragCancel() {
        setActiveId(null);
        onDragEnd?.();
        setColumns(build());
      },
    }),
    [sensors, findContainer, columns, build, onMove, onDragStart, onDragEnd]
  );

  return { columns, activeId, handlers };
}
