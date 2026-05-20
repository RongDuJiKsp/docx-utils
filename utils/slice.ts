export function resolveSliceRange(total: number, arg1?: number, arg2?: number): [number, number] {
	if (arg1 === undefined) {
		return [0, total]
	}

	const start = Math.min(arg1, total)

	if (arg2 === undefined) {
		return [start, Math.min(total, start + 20)]
	}

	if (arg2 < arg1) {
		throw new Error(`arg2 必须大于等于 arg1，当前 arg1=${arg1}, arg2=${arg2}`)
	}

	return [start, Math.min(arg2, total)]
}
