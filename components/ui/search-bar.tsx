import type { InputHTMLAttributes } from "react";
import { SearchInput } from "./search-input";

type SearchBarProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function SearchBar(props: SearchBarProps) {
  return <SearchInput {...props} />;
}
