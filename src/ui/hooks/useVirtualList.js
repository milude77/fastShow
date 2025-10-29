import { useState, useRef, useEffect, useCallback } from "react";

/**
 * useVirtualList
 * @param {Array} list - 原始数据列表
 * @param {Function|number} getItemHeight - 获取每条 item 高度，固定值或函数
 * @param {number} containerHeight - 可见容器高度
 */

export function useVirtualList(list, getItemHeight, containerHeight) {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);

  // 计算每条 item 的累计偏移 top
  const [offsets, setOffsets] = useState([]);

  useEffect(() => {
    let _offsets = [];
    let top = 0;
    for (let i = 0; i < list.length; i++) {
      const height = typeof getItemHeight === "function" ? getItemHeight(list[i], i) : getItemHeight;
      _offsets.push(top);
      top += height;
    }
    setOffsets(_offsets);
  }, [list, getItemHeight]);

  const handleScroll = useCallback((e) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // 计算可视区 startIndex / endIndex
  const startIndex = offsets.findIndex((top) => top + (typeof getItemHeight === "function" ? getItemHeight(list[0]) : getItemHeight) > scrollTop);
  let visibleCount = Math.ceil(containerHeight / (typeof getItemHeight === "function" ? getItemHeight(list[0]) : getItemHeight));
  const endIndex = Math.min(list.length, startIndex + visibleCount + 5); // buffer 5

  // 可渲染列表
  const visibleList = list.slice(startIndex, endIndex);

  return {
    containerRef,
    handleScroll,
    visibleList,
    offsets,
    startIndex,
    endIndex
  };
}
