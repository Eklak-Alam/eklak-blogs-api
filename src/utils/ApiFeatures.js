/**
 * Enterprise Query Builder Engine for Prisma
 * Automates complex filtering, sorting, field limiting, and pagination dynamically from URL query strings.
 */
class ApiFeatures {
  /**
   * @param {Object} prismaQueryObj - Initial Prisma `where` object (e.g., base filters like { status: 'PUBLISHED' })
   * @param {Object} queryString - Express `req.query` object
   */
  constructor(prismaQueryObj = {}, queryString = {}) {
    this.prismaQueryObj = { where: prismaQueryObj };
    this.queryString = queryString;
  }

  /**
   * 1. Advanced Filtering
   * Parses standard operators like gte, gt, lte, lt
   * Example: ?viewCount[gte]=100
   */
  filter() {
    const queryObj = { ...this.queryString };
    
    // Remove fields handled by other methods
    const excludedFields = ['page', 'sort', 'limit', 'fields', 'search'];
    excludedFields.forEach((el) => delete queryObj[el]);

    // Parse advanced operators (gte, lte, etc.)
    // Transforms { viewCount: { gte: '100' } } to Prisma compatible operators
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt|in)\b/g, (match) => match);
    
    const parsedFilters = JSON.parse(queryStr);

    // Merge with the base `where` clause
    this.prismaQueryObj.where = { ...this.prismaQueryObj.where, ...parsedFilters };

    return this;
  }

  /**
   * 2. Search
   * Performs an OR search across specified text fields.
   * Example: ?search=technology
   */
  search(searchFields = []) {
    if (this.queryString.search && searchFields.length > 0) {
      const searchStr = this.queryString.search;
      this.prismaQueryObj.where = {
        ...this.prismaQueryObj.where,
        OR: searchFields.map((field) => ({
          [field]: { contains: searchStr, mode: 'insensitive' },
        })),
      };
    }
    return this;
  }

  /**
   * 3. Sorting
   * Example: ?sort=-createdAt,viewCount
   */
  sort() {
    if (this.queryString.sort) {
      const sortByArray = this.queryString.sort.split(',').map((el) => {
        if (el.startsWith('-')) {
          return { [el.substring(1)]: 'desc' };
        }
        return { [el]: 'asc' };
      });
      this.prismaQueryObj.orderBy = sortByArray;
    } else {
      // Default sorting
      this.prismaQueryObj.orderBy = { createdAt: 'desc' };
    }
    return this;
  }

  /**
   * 4. Field Limiting (Projection)
   * Example: ?fields=title,slug,createdAt
   */
  limitFields() {
    if (this.queryString.fields) {
      const fieldsArray = this.queryString.fields.split(',');
      const selectObj = {};
      fieldsArray.forEach((field) => {
        selectObj[field] = true;
      });
      this.prismaQueryObj.select = selectObj;
    }
    return this;
  }

  /**
   * 5. Pagination
   * Example: ?page=2&limit=20
   */
  paginate() {
    const page = this.queryString.page ? Number(this.queryString.page) : 1;
    let limit = this.queryString.limit ? Number(this.queryString.limit) : 10;
    
    // Security: Prevent database DoS by enforcing a hard maximum limit
    if (limit > 100) limit = 100;

    const skip = (page - 1) * limit;

    this.prismaQueryObj.skip = skip;
    this.prismaQueryObj.take = limit;
    
    // Expose pagination metadata for the controller to use
    this.paginationMeta = { page, limit };

    return this;
  }

  /**
   * Returns the final Prisma configuration object
   */
  query() {
    return this.prismaQueryObj;
  }
}

export default ApiFeatures;
