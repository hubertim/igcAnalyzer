import { useEffect, useState } from "react";
import { WIDE_BREAKPOINT } from "../constants";

export function useResponsive(breakpoint = WIDE_BREAKPOINT) {
  const [isWide, setIsWide] = useState(
    () => window.innerWidth > breakpoint,
  );

  useEffect(() => {
    const handleResize = () => {
      setIsWide(window.innerWidth > breakpoint);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [breakpoint]);

  return isWide;
}
