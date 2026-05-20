export function parseNonNegativeInteger(rawValue: undefined, argName: string): undefined
export function parseNonNegativeInteger(rawValue: string, argName: string): number
export function parseNonNegativeInteger(rawValue: string | undefined, argName: string): number | undefined
export function parseNonNegativeInteger(rawValue: string | undefined, argName: string): number | undefined {
	if (rawValue === undefined) {
		return undefined
	}

	const value = Number(rawValue)

	if (!Number.isInteger(value) || value < 0) {
		throw new Error(`${argName} 必须是大于等于 0 的整数，当前值: ${rawValue}`)
	}

	return value
}
